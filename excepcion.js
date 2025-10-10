import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql/*sql*/`
      select
        id_regular as "ID_Regular",
        to_char(fecha,'YYYY-MM-DD') as "Fecha"
      from excepcion
      order by fecha
    `;
    res.status(200).json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
