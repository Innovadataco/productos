import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET() {
    try {
        const settings = await prisma.moduleSetting.findMany({
            include: {
                aiModel: {
                    select: {
                        id: true,
                        name: true,
                        provider: true,
                        modelPath: true,
                        active: true
                    }
                }
            }
        });
        return NextResponse.json({ settings });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
    import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET() {
    try {
        const settings = await prisma.module
 import { prisma } from "@/lib/prisma";
import { verifyA
 import { ve!module || !settingKey || !a
export async function GET() {
    try ons    try {
        const settro        os            include: {
                aiModel: {
                             aiMod                      selec        setting = await prisma.m                        name: tr                          provider: tt                        modelPath: tru                          active: true
                        }
             da                }
                }
            });
at        reDa    } catch (error: any) {
        return Next          return N,
             }
}

export async function PUT(request: NextRequest) {
    try {
    imlu}

e{
       try {
    import { NextRequest, NextResponsect    impo  import { pri      id: true,
                        name: truimport { verifyAuth } from "@/lib/auttr
export async function GET() {
    try tru    try {
        const settct        e
 import { prisma } from "@/lib/prisma";
imp  import { verifyA
 impo        return Nex import { ve!mo{ export async function GET()ror: any) {
      try ons    try {
       on        const settrsa                aiModel:    }
}
