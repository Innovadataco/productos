const parser = require('@babel/parser');
const fs = require('fs');
const path = require('path');

const root = '/Users/idc/productos/INNOVADATACO/002-2026-PROTECCION-INFANTIL/src';

function isIconElement(node) {
    if (!node) return false;
    if (node.type === 'JSXElement') {
        const name = node.openingElement.name.name;
        if (name === 'svg') return true;
        if (name && name.endsWith('Icon')) return true;
    }
    return false;
}

function containsIcon(node) {
    if (!node) return false;
    if (isIconElement(node)) return true;
    if (node.type === 'JSXElement') {
        if (node.children) for (const c of node.children) if (containsIcon(c)) return true;
    }
    if (node.type === 'JSXExpressionContainer' && node.expression) {
        if (node.expression.type === 'ConditionalExpression') {
            return containsIcon(node.expression.consequent) || containsIcon(node.expression.alternate);
        }
    }
    return false;
}

function hasAccessibleName(node) {
    if (!node || node.type !== 'JSXOpeningElement') return false;
    for (const a of node.attributes) {
        if (a.type !== 'JSXAttribute') continue;
        const n = a.name.name;
        if (n === 'aria-label' || n === 'title' || n === 'aria-labelledby') return true;
        if (n === 'aria-hidden' && (a.value?.value === true || a.value?.value === 'true')) return true;
    }
    return false;
}

function hasVisibleText(node) {
    if (!node) return false;
    if (node.type === 'JSXText' || node.type === 'StringLiteral') {
        return /[A-Za-zÁÉÍÓÚáéíóúñÑ]{2,}/.test(node.value);
    }
    if (node.type === 'JSXElement') {
        if (node.children) return node.children.some(hasVisibleText);
    }
    if (node.type === 'JSXExpressionContainer' && node.expression) {
        return hasVisibleText(node.expression);
    }
    if (node.type === 'ConditionalExpression') {
        return hasVisibleText(node.consequent) || hasVisibleText(node.alternate);
    }
    return false;
}

function getSvgAttributes(node) {
    if (node.type !== 'JSXElement' || node.openingElement.name.name !== 'svg') return null;
    const attrs = {};
    for (const a of node.openingElement.attributes) {
        if (a.type === 'JSXAttribute') attrs[a.name.name] = a.value?.value;
    }
    return attrs;
}

function isInteractiveElement(tagName) {
    return ['button', 'a', 'input', 'select', 'textarea'].includes(tagName);
}

function hasInteractiveAttributes(attrs) {
    let hasRole = false;
    let hasTabIndex = false;
    for (const a of attrs) {
        if (a.type !== 'JSXAttribute') continue;
        const n = a.name.name;
        if (n === 'role' && a.value?.value) hasRole = true;
        if (n === 'tabIndex' && (a.value?.value !== undefined || a.value?.value !== -1)) hasTabIndex = true;
    }
    return { hasRole, hasTabIndex };
}

const iconButtons = [];
const standaloneIcons = [];
const nonInteractiveClickables = [];

function walk(node, file) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'JSXElement') {
        const tagName = node.openingElement.name.name;
        if ((tagName === 'button' || tagName === 'Button') && containsIcon(node) && !hasAccessibleName(node.openingElement) && !hasVisibleText(node)) {
            iconButtons.push({ file: path.relative(root, file), line: node.loc?.start?.line, tag: tagName });
        }
        if (tagName === 'svg' && !hasAccessibleName(node.openingElement)) {
            const attrs = getSvgAttributes(node);
            standaloneIcons.push({ file: path.relative(root, file), line: node.loc?.start?.line, attrs });
        }
        if (!isInteractiveElement(tagName) && tagName && tagName[0] === tagName[0].toLowerCase()) {
            for (const a of node.openingElement.attributes) {
                if (a.type === 'JSXAttribute' && a.name.name === 'onClick' && a.value?.expression) {
                    const { hasRole, hasTabIndex } = hasInteractiveAttributes(node.openingElement.attributes);
                    const fileRel = path.relative(root, file);
                    if (fileRel.startsWith('components/ui')) continue;
                    if (!hasRole || !hasTabIndex) {
                        nonInteractiveClickables.push({
                            file: fileRel,
                            line: node.loc?.start?.line,
                            tag: tagName,
                            hasRole,
                            hasTabIndex,
                        });
                    }
                    break;
                }
            }
        }
    }
    for (const key of Object.keys(node)) {
        const val = node[key];
        if (Array.isArray(val)) val.forEach(v => walk(v, file));
        else walk(val, file);
    }
}

function analyzeFile(file) {
    const code = fs.readFileSync(file, 'utf-8');
    let ast;
    try {
        ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
    } catch (e) { return; }
    walk(ast, file);
}

function walkDir(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walkDir(full);
        else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) analyzeFile(full);
    }
}

walkDir(root);

let exitCode = 0;

console.log(`Icon-only buttons without accessible label: ${iconButtons.length}`);
iconButtons.forEach(i => console.log(`  ${i.file}:${i.line} <${i.tag}>`));
if (iconButtons.length > 0) exitCode = 1;

console.log(`\nSVG elements without accessible name or aria-hidden: ${standaloneIcons.length}`);
standaloneIcons.forEach(i => console.log(`  ${i.file}:${i.line} ${JSON.stringify(i.attrs)}`));
if (standaloneIcons.length > 0) exitCode = 1;

console.log(`\nNon-interactive elements with onClick missing role and/or tabIndex: ${nonInteractiveClickables.length}`);
nonInteractiveClickables.forEach(i => {
    const missing = [i.hasRole ? '' : 'role', i.hasTabIndex ? '' : 'tabIndex'].filter(Boolean).join('/');
    console.log(`  ${i.file}:${i.line} <${i.tag}> missing ${missing}`);
});
if (nonInteractiveClickables.length > 0) exitCode = 1;

if (exitCode === 0) {
    console.log('\nNo accessibility issues found.');
}

process.exit(exitCode);
