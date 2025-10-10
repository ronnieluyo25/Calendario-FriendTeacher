import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql/*sql*/`
      select
        id_evento as "ID_Evento",
        alumno    as "Alumno",
        tutor     as "Tutor",
        curso     as "Curso",
        modalidad as "Modalidad",
        to_char(fecha,'YYYY-MM-DD')        as "Fecha",
        to_char(hora_inicio,'HH24:MI:SS')  as "Hora_Inicio",
        to_char(hora_final, 'HH24:MI:SS')  as "Hora_Final"
      from eventual
      order by fecha, hora_inicio
    `;
    res.status(200).json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
