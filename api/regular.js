import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql/*sql*/`
      select
        id_regular as "ID_Regular",
        alumno     as "Alumno",
        tutor      as "Tutor",
        curso      as "Curso",
        modalidad  as "Modalidad",
        dia_semana as "Dia_Semana",
        to_char(hora_inicio, 'HH24:MI:SS') as "Hora_Inicio",
        to_char(hora_final,  'HH24:MI:SS') as "Hora_Final",
        to_char(inicio_contrato,'YYYY-MM-DD') as "Inicio_Contrato",
        to_char(fin_contrato,   'YYYY-MM-DD') as "Fin_Contrato"
      from regular
      order by alumno, tutor, curso
    `;
    res.status(200).json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
