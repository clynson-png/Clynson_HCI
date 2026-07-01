export const TAURUS_TARGET_SCHEMA_V1 = {
  database: {
    name: 'TAURUS_TARGET_DB_V1',
    version: 1,
  },
  tables: {
    taurus_target_session: {
      purpose: 'Manual target session header for the Taurus target module',
      fields: [
        'session_id',
        'athlete_name',
        'target_type',
        'session_mode',
        'session_label',
        'notes',
        'max_shots',
        'max_score',
        'total_shots',
        'total_score',
        'shot_details_json',
        'recorded_at',
        'updated_at',
      ],
    },
    taurus_target_hit: {
      purpose: 'Per-zone manual hit counts used to build Taurus performance charts',
      fields: [
        'hit_id',
        'session_id',
        'zone_code',
        'zone_label',
        'hit_count',
        'display_order',
        'meta_json',
      ],
    },
  },
}
