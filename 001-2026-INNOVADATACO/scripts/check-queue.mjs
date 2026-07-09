import { config } from "dotenv";
import pg from "pg";

config({ path: ".env" });
config({ path: ".env.local" });

const { Client } = pg;

async function main() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    try {
        const res = await client.query(
            "SELECT name, state, data FROM pgboss.job WHERE name = 'process-document' LIMIT 5"
        );
        console.log("Jobs en cola process-document:");
        res.rows.forEach((row) => {
            console.log("  - State:", row.state);
            console.log("    Data:", row.data);
        });

        if (res.rows.length === 0) {
            console.log("  (ninguno)");
        }
    } catch (e) {
        console.error("Error:", e.message);
    }

    await client.end();
}

main();