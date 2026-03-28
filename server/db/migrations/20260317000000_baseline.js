// ============================================================
// BASELINE MIGRATION — Full schema for Signal Forge
// ============================================================
// Converts the SQLite schema.sql to PostgreSQL via Knex.
// - TEXT PRIMARY KEY → uuid default gen_random_uuid()
// - datetime('now') → now()
// - JSON TEXT → jsonb
// - user_id on all user-scoped tables
// - Proper CHECK constraints and indexes
// ============================================================

export async function up(knex) {
  // ---- THESES (must come first — signals references theses via FK) ----
  await knex.schema.createTable("theses", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.text("user_id").notNullable().defaultTo("default");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    t.text("title").notNullable();
    t.text("thesis_statement").notNullable();
    t.jsonb("causal_chain").notNullable();
    t.jsonb("affected_assets").notNullable();
    t.jsonb("expected_timeline").notNullable();

    t.float("probability_low").notNullable();
    t.float("probability_high").notNullable();
    t.float("probability_best").notNullable();
    t.jsonb("market_pricing_assessment").notNullable();
    t.jsonb("key_assumptions").notNullable();
    t.jsonb("alternative_explanations").notNullable();

    t.jsonb("leading_indicators");
    t.jsonb("confirming_indicators");
    t.jsonb("invalidating_indicators");
    t.jsonb("coincident_indicators");
    t.jsonb("lagging_indicators");

    t.jsonb("disconfirming_evidence").notNullable();
    t.text("strongest_bear_case").notNullable();
    t.text("what_would_make_opposite_stronger").notNullable();
    t.text("early_vs_right");

    t.float("score_signal_quality");
    t.float("score_signal_independence");
    t.float("score_evidence_freshness");
    t.float("score_data_reliability");
    t.float("score_evidence_quantity");
    t.float("score_evidence_layer");

    t.float("score_causal_chain_clarity");
    t.float("score_internal_consistency");
    t.float("score_counter_case_robustness");
    t.float("score_assumption_load");
    t.float("score_timing_clarity");
    t.float("score_structure_layer");

    t.float("score_market_awareness");
    t.float("score_prediction_market_divergence");
    t.float("score_asset_reaction_gaps");
    t.float("score_liquidity_sensitivity");
    t.float("score_catalyst_clarity");
    t.float("score_market_edge_layer");

    t.float("composite_score");
    t.float("penalty_total");
    t.jsonb("penalty_details");

    t.float("confidence_level");
    t.jsonb("confidence_factors");

    t.float("score_at_creation");
    t.float("score_at_approval");
    t.text("classification_at_creation");
    t.jsonb("final_outcome");

    t.float("score_market_mispricing");
    t.float("score_causal_clarity");
    t.float("score_catalyst_visibility");
    t.float("score_timing_precision");
    t.float("score_expression_quality");
    t.float("score_risk_containment");
    t.float("score_disconfirmation_robustness");
    t.float("score_emotional_neutrality");

    t.text("classification").notNullable().defaultTo("WATCH");
    t.text("classification_reason");
    t.jsonb("previous_classifications");

    t.text("status").notNullable().defaultTo("active");
    t.text("quarantine_reason");
    t.timestamp("quarantine_until");

    t.jsonb("tags");
  });

  // ---- SIGNALS ----
  await knex.schema.createTable("signals", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.text("user_id").notNullable().defaultTo("default");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    t.text("category").notNullable();
    t.text("subcategory");

    t.text("title").notNullable();
    t.text("description").notNullable();
    t.text("raw_source");
    t.text("source_type").notNullable();
    t.text("source_provider");
    t.text("source_url");
    t.text("source_attribution");

    t.text("novelty").notNullable().defaultTo("unknown");
    t.text("reliability").notNullable().defaultTo("unverified");
    t.float("signal_strength");

    t.uuid("thesis_id").references("id").inTable("theses").onDelete("SET NULL");
    t.jsonb("related_signal_ids");

    t.text("status").notNullable().defaultTo("inbox");
    t.jsonb("tags");

    // Normalized signal fields (used by ingestion pipeline)
    t.text("entity");
    t.float("value");
    t.float("previous_value");
    t.float("change");
    t.integer("significance");
    t.text("direction");
    t.text("summary");
  });

  // ---- EXECUTION PLANS ----
  await knex.schema.createTable("execution_plans", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("thesis_id").notNullable().references("id").inTable("theses").onDelete("CASCADE");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    t.text("expression_vehicle").notNullable();
    t.text("asset_symbol").notNullable();
    t.text("asset_class").notNullable();
    t.text("direction").notNullable();

    t.float("max_risk_dollars");
    t.float("max_risk_percent");
    t.float("position_size_units");
    t.float("position_size_notional");
    t.text("sizing_rationale");

    t.text("entry_logic").notNullable();
    t.float("entry_price_target");
    t.float("stop_loss");
    t.float("take_profit_1");
    t.float("take_profit_2");
    t.text("exit_logic").notNullable();
    t.text("time_stop");
    t.text("invalidation_condition").notNullable();

    t.boolean("gate_passed").notNullable().defaultTo(false);
    t.jsonb("gate_results");
    t.timestamp("gate_passed_at");

    t.text("status").notNullable().defaultTo("draft");
    t.text("execution_notes");
  });

  // ---- CHECKLIST RESULTS ----
  await knex.schema.createTable("checklist_results", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("execution_plan_id").notNullable().references("id").inTable("execution_plans").onDelete("CASCADE");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.integer("gate_min_confirming_signals");
    t.integer("gate_confirming_signal_count");
    t.integer("gate_disconfirming_case_written");
    t.integer("gate_time_horizon_defined");
    t.integer("gate_invalidation_defined");
    t.integer("gate_max_risk_set");
    t.integer("gate_expression_vehicle_defined");
    t.integer("gate_entry_logic_defined");
    t.integer("gate_exit_logic_defined");
    t.integer("gate_position_sizing_rule");
    t.text("gate_emotional_state_check");
    t.integer("gate_emotional_state_passed");
    t.integer("gate_sleep_on_it");
    t.timestamp("gate_sleep_on_it_until");
    t.integer("gate_confidence_vs_evidence");
    t.integer("gate_not_narrative_attached");
    t.integer("gate_asymmetry_confirmed");

    t.integer("total_gates").notNullable();
    t.integer("gates_passed").notNullable();
    t.integer("gates_failed").notNullable();
    t.boolean("overall_passed").notNullable().defaultTo(false);
    t.jsonb("failure_reasons");
    t.boolean("override_requested").notNullable().defaultTo(false);
    t.text("override_reason");
    t.boolean("override_approved").notNullable().defaultTo(false);
  });

  // ---- TRADES ----
  await knex.schema.createTable("trades", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("execution_plan_id").notNullable().references("id").inTable("execution_plans");
    t.uuid("thesis_id").notNullable().references("id").inTable("theses");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    t.text("asset_symbol").notNullable();
    t.text("direction").notNullable();
    t.float("entry_price").notNullable();
    t.text("entry_date").notNullable();
    t.float("size_units").notNullable();
    t.float("size_notional").notNullable();

    t.float("current_price");
    t.float("unrealized_pnl");
    t.float("unrealized_pnl_percent");

    t.float("exit_price");
    t.text("exit_date");
    t.float("realized_pnl");
    t.float("realized_pnl_percent");

    t.text("status").notNullable().defaultTo("open");
    t.text("close_reason");
    t.text("notes");
  });

  // ---- REVIEWS ----
  await knex.schema.createTable("reviews", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("thesis_id").notNullable().references("id").inTable("theses");
    t.uuid("trade_id").references("id").inTable("trades");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.text("outcome").notNullable();
    t.text("outcome_description").notNullable();

    t.jsonb("signals_that_mattered");
    t.jsonb("signals_that_were_noise");
    t.jsonb("signals_missed");

    t.boolean("process_followed").notNullable();
    t.jsonb("process_violations");
    t.boolean("sizing_appropriate");
    t.boolean("timing_appropriate");
    t.boolean("early_confirmation_accurate");

    t.text("emotional_state_during");
    t.boolean("overconfidence_detected");
    t.boolean("narrative_attachment_detected");
    t.boolean("confirmation_bias_detected");

    t.text("lessons_learned").notNullable();
    t.jsonb("playbook_additions");
    t.jsonb("rule_changes");

    t.float("process_score");
    t.float("analysis_score");
    t.float("execution_score");
    t.float("overall_score");
  });

  // ---- PLAYBOOK ENTRIES ----
  await knex.schema.createTable("playbook_entries", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    t.text("title").notNullable();
    t.text("category").notNullable();
    t.text("pattern_description").notNullable();
    t.jsonb("trigger_conditions").notNullable();
    t.jsonb("typical_assets").notNullable();
    t.text("typical_timeline");
    t.jsonb("historical_examples");
    t.float("success_rate_estimate");
    t.jsonb("key_lessons");
    t.jsonb("common_mistakes");
    t.text("status").notNullable().defaultTo("active");
  });

  // ---- MARKET OBSERVATIONS ----
  await knex.schema.createTable("market_observations", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.text("provider").notNullable();
    t.text("provider_raw_id");
    t.text("source_attribution").notNullable();
    t.timestamp("fetched_at").notNullable();

    t.text("observation_type").notNullable();
    t.text("symbol");
    t.text("name");
    t.jsonb("data").notNullable();
    t.jsonb("metadata");

    t.uuid("thesis_id").references("id").inTable("theses").onDelete("SET NULL");
    t.uuid("signal_id").references("id").inTable("signals").onDelete("SET NULL");
  });

  // ---- PROVIDER CACHE ----
  await knex.schema.createTable("provider_cache", (t) => {
    t.text("cache_key").primary();
    t.text("provider").notNullable();
    t.jsonb("data").notNullable();
    t.timestamp("fetched_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("expires_at").notNullable();
    t.integer("hit_count").notNullable().defaultTo(0);
  });

  // ---- PREDICTION MARKET PROVIDERS ----
  await knex.schema.createTable("prediction_market_providers", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.text("name").notNullable();
    t.text("provider_key").notNullable().unique();
    t.text("base_url");
    t.boolean("active").notNullable().defaultTo(true);
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  });

  // ---- PREDICTION MARKET EVENTS ----
  await knex.schema.createTable("prediction_market_events", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("provider_id").notNullable().references("id").inTable("prediction_market_providers");
    t.text("external_market_id");
    t.text("title").notNullable();
    t.text("description");
    t.text("url");
    t.text("category");
    t.text("status").notNullable().defaultTo("open");
    t.timestamp("open_time");
    t.timestamp("close_time");
    t.timestamp("resolution_time");
    t.text("market_type").defaultTo("binary");
    t.jsonb("tags_json");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  });

  // ---- PREDICTION MARKET SNAPSHOTS ----
  await knex.schema.createTable("prediction_market_snapshots", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("prediction_market_event_id").notNullable().references("id").inTable("prediction_market_events").onDelete("CASCADE");
    t.timestamp("observed_at").notNullable();
    t.float("yes_price");
    t.float("no_price");
    t.float("implied_probability").notNullable();
    t.float("volume_24h");
    t.float("liquidity");
    t.float("spread");
    t.text("source_attribution").notNullable();
    t.text("raw_payload_ref");
    t.boolean("is_stale").notNullable().defaultTo(false);
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });

  // ---- THESIS PREDICTION LINKS ----
  await knex.schema.createTable("thesis_prediction_links", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("thesis_id").notNullable().references("id").inTable("theses").onDelete("CASCADE");
    t.uuid("prediction_market_event_id").notNullable().references("id").inTable("prediction_market_events").onDelete("CASCADE");
    t.float("link_confidence").notNullable().defaultTo(0.5);
    t.text("link_type").notNullable().defaultTo("partial_match");
    t.float("wording_match_score").notNullable().defaultTo(0.5);
    t.boolean("wording_mismatch_flag").notNullable().defaultTo(false);
    t.text("rationale");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  });

  // ---- PREDICTION MARKET ASSESSMENTS ----
  await knex.schema.createTable("prediction_market_assessments", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("thesis_id").notNullable().references("id").inTable("theses").onDelete("CASCADE");
    t.timestamp("assessed_at").notNullable().defaultTo(knex.fn.now());
    t.float("thesis_probability_low");
    t.float("thesis_probability_high");
    t.float("prediction_market_implied_probability");
    t.float("divergence_score");
    t.text("consensus_state").notNullable().defaultTo("not_comparable");
    t.boolean("wording_warning").notNullable().defaultTo(false);
    t.boolean("liquidity_warning").notNullable().defaultTo(false);
    t.float("thin_market_penalty").defaultTo(0);
    t.text("notes");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });

  // ---- LLM THESIS ASSESSMENTS ----
  await knex.schema.createTable("llm_thesis_assessments", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("thesis_id").notNullable().references("id").inTable("theses").onDelete("CASCADE");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.text("model_provider").notNullable();
    t.text("model_name").notNullable();
    t.text("prompt_version").notNullable();

    t.float("score_evidence_strength");
    t.float("score_signal_independence");
    t.float("score_structural_logic");
    t.float("score_timing_clarity");
    t.float("score_market_edge");
    t.float("score_counter_case_robustness");

    t.float("overall_score");
    t.float("confidence_level");

    t.text("strongest_counter_case");
    t.jsonb("hidden_assumptions");
    t.jsonb("key_missing_information");
    t.jsonb("top_supporting_signals");
    t.jsonb("top_concerns");
    t.text("recommendation");

    t.float("deterministic_score");
    t.float("score_delta");
    t.text("disagreement_summary");

    t.jsonb("thesis_packet_json").notNullable();
    t.jsonb("raw_response_json").notNullable();
    t.integer("prompt_tokens");
    t.integer("completion_tokens");
    t.integer("latency_ms");

    t.text("status").notNullable().defaultTo("completed");
    t.text("error_message");
  });

  // ---- BOT PIPELINE RUNS ----
  await knex.schema.createTable("bot_pipeline_runs", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.timestamp("run_at").notNullable();
    t.integer("duration_ms");
    t.text("status").notNullable();
    t.jsonb("summary");
    t.jsonb("full_result");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });

  // ---- BOT RECOMMENDATIONS ----
  await knex.schema.createTable("bot_recommendations", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("pipeline_run_id").notNullable();
    t.text("cluster_id").notNullable();
    t.text("cluster_title");
    t.text("recommended_state").notNullable();
    t.float("confidence_best");
    t.text("rationale");
    t.text("why_not_higher");
    t.integer("penalties_count");
    t.integer("overrides_count");
    t.text("pattern_match_name");
    t.text("mispricing_state");
    t.float("counter_case_quality");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });

  // ---- ALERTS (new for Session 1a) ----
  await knex.schema.createTable("alerts", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.text("user_id").notNullable().defaultTo("default");
    t.text("type").notNullable();
    t.uuid("trade_plan_id");
    t.uuid("thesis_id");
    t.text("message").notNullable();
    t.boolean("sent").notNullable().defaultTo(false);
    t.boolean("acknowledged").notNullable().defaultTo(false);
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });

  // ---- PROVIDER HEALTH (new for Session 1a) ----
  await knex.schema.createTable("provider_health", (t) => {
    t.text("provider_name").primary();
    t.timestamp("last_check");
    t.text("status");
    t.text("last_error");
    t.integer("consecutive_failures").defaultTo(0);
  });

  // ---- DEAD LETTER QUEUE (new for Session 1a) ----
  await knex.schema.createTable("dead_letter_queue", (t) => {
    t.uuid("failed_job_id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.text("job_type").notNullable();
    t.jsonb("payload");
    t.text("error");
    t.integer("retry_count").defaultTo(0);
    t.timestamp("next_retry");
  });

  // ============================================================
  // INDEXES
  // ============================================================
  await knex.schema.alterTable("signals", (t) => {
    t.index("user_id");
    t.index("category");
    t.index("status");
    t.index("thesis_id");
    t.index("created_at");
  });

  await knex.schema.alterTable("theses", (t) => {
    t.index("user_id");
    t.index("status");
    t.index("classification");
    t.index("composite_score");
  });

  await knex.schema.alterTable("execution_plans", (t) => {
    t.index("thesis_id");
    t.index("status");
  });

  await knex.schema.alterTable("trades", (t) => {
    t.index("thesis_id");
    t.index("status");
  });

  await knex.schema.alterTable("reviews", (t) => {
    t.index("thesis_id");
  });

  await knex.schema.alterTable("market_observations", (t) => {
    t.index("observation_type");
    t.index("symbol");
    t.index("provider");
  });

  await knex.schema.alterTable("provider_cache", (t) => {
    t.index("expires_at");
  });

  await knex.schema.alterTable("prediction_market_events", (t) => {
    t.index("provider_id");
    t.index("status");
    t.index("category");
  });

  await knex.schema.alterTable("prediction_market_snapshots", (t) => {
    t.index("prediction_market_event_id");
    t.index("observed_at");
  });

  await knex.schema.alterTable("thesis_prediction_links", (t) => {
    t.index("thesis_id");
    t.index("prediction_market_event_id");
  });

  await knex.schema.alterTable("prediction_market_assessments", (t) => {
    t.index("thesis_id");
  });

  await knex.schema.alterTable("llm_thesis_assessments", (t) => {
    t.index("thesis_id");
    t.index("created_at");
  });

  await knex.schema.alterTable("alerts", (t) => {
    t.index("user_id");
  });
}

export async function down(knex) {
  const tables = [
    "dead_letter_queue",
    "provider_health",
    "alerts",
    "bot_recommendations",
    "bot_pipeline_runs",
    "llm_thesis_assessments",
    "prediction_market_assessments",
    "thesis_prediction_links",
    "prediction_market_snapshots",
    "prediction_market_events",
    "prediction_market_providers",
    "provider_cache",
    "market_observations",
    "playbook_entries",
    "reviews",
    "trades",
    "checklist_results",
    "execution_plans",
    "signals",
    "theses",
  ];

  for (const table of tables) {
    await knex.schema.dropTableIfExists(table);
  }
}
