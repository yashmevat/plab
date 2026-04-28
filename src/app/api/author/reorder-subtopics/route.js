import pool from '@/lib/db';

export async function POST(req) {
  try {
    const { topicId, orderedIds } = await req.json();
    
    if (!Array.isArray(orderedIds) || !topicId) {
      return Response.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    if (orderedIds.length === 0) {
      return Response.json({ success: true });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Build CASE statement for batch update
      const cases = orderedIds.map(() => `WHEN ? THEN ?`).join(' ');
      const idsPlaceholders = orderedIds.map(() => '?').join(',');
      
      const sql = `
        UPDATE subtopics 
        SET sort_order = CASE id ${cases} ELSE sort_order END 
        WHERE topic_id = ? AND id IN (${idsPlaceholders})
      `;
      
      // Build params: [id1, order1, id2, order2, ..., topicId, id1, id2, ...]
      const caseParams = orderedIds.flatMap((id, idx) => [id, idx + 1]);
      const params = [...caseParams, topicId, ...orderedIds];

      await conn.query(sql, params);
      await conn.commit();
      
      return Response.json({ success: true });
    } catch (err) {
      await conn.rollback();
      console.error('Error reordering subtopics:', err);
      return Response.json({ success: false, error: err.message }, { status: 500 });
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
