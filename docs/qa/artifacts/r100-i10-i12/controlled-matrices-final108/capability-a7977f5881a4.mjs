// docs/qa/artifacts/r100-i10-i12/controlled-matrices-final108/sources/tools/qa/check-r100-cross-world-capabilities.ts
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/generated/contaminant-catalog-data.ts
var CATALOG_ITEMS = {
  "amber_beetle": {
    "id": "amber_beetle",
    "class": "core",
    "familyId": "solidify",
    "grade": 1,
    "name": "\u7425\u73C0\u7532\u866B",
    "description": "\u505C\u4F4F\u4E00\u654C2.5\u79D2\uFF1B\u53D7\u4F24\u89E3\u9664",
    "paramKey": "freeze_duration_ms",
    "paramValue": 2500,
    "durationMs": 2500,
    "rangePx": 128,
    "baseUses": 5,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "amber_beetle",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "stopped_pocket_watch": {
    "id": "stopped_pocket_watch",
    "class": "core",
    "familyId": "solidify",
    "grade": 2,
    "name": "\u505C\u6446\u6000\u8868",
    "description": "\u505C\u4F4F\u4E00\u654C4\u79D2\uFF1B\u53D7\u4F24\u89E3\u9664",
    "paramKey": "freeze_duration_ms",
    "paramValue": 4e3,
    "durationMs": 4e3,
    "rangePx": 128,
    "baseUses": 5,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "stopped_pocket_watch",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "sealed_hourglass": {
    "id": "sealed_hourglass",
    "class": "core",
    "familyId": "solidify",
    "grade": 3,
    "name": "\u5C01\u5E95\u6C99\u6F0F",
    "description": "\u505C\u4F4F\u4E00\u654C5.5\u79D2\uFF1B\u53D7\u4F24\u89E3\u9664",
    "paramKey": "freeze_duration_ms",
    "paramValue": 5500,
    "durationMs": 5500,
    "rangePx": 128,
    "baseUses": 5,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "sealed_hourglass",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "brass_monocle": {
    "id": "brass_monocle",
    "class": "core",
    "familyId": "sight",
    "grade": 1,
    "name": "\u94DC\u6846\u5355\u955C",
    "description": "\u672C\u8D9F\u89C6\u8DDD\u589E\u52A010%",
    "paramKey": "vision_radius_multiplier",
    "paramValue": 1.1,
    "durationMs": 0,
    "rangePx": 0,
    "baseUses": 2,
    "weight": 20,
    "slot": "passive",
    "scope": "run",
    "iconId": "brass_monocle",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "milky_fish_eye": {
    "id": "milky_fish_eye",
    "class": "core",
    "familyId": "sight",
    "grade": 2,
    "name": "\u767D\u819C\u9C7C\u773C",
    "description": "\u672C\u8D9F\u89C6\u8DDD\u589E\u52A020%",
    "paramKey": "vision_radius_multiplier",
    "paramValue": 1.2,
    "durationMs": 0,
    "rangePx": 0,
    "baseUses": 2,
    "weight": 20,
    "slot": "passive",
    "scope": "run",
    "iconId": "milky_fish_eye",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "doorless_lantern": {
    "id": "doorless_lantern",
    "class": "core",
    "familyId": "sight",
    "grade": 3,
    "name": "\u7F3A\u95E8\u63D0\u706F",
    "description": "\u672C\u8D9F\u89C6\u8DDD\u589E\u52A030%",
    "paramKey": "vision_radius_multiplier",
    "paramValue": 1.3,
    "durationMs": 0,
    "rangePx": 0,
    "baseUses": 2,
    "weight": 20,
    "slot": "passive",
    "scope": "run",
    "iconId": "doorless_lantern",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "salted_vial": {
    "id": "salted_vial",
    "class": "core",
    "familyId": "resistance",
    "grade": 1,
    "name": "\u76D0\u5C01\u836F\u74F6",
    "description": "30\u79D2\u5185\u6297\u6C61\u589E\u52A020",
    "paramKey": "contamination_resistance_points",
    "paramValue": 20,
    "durationMs": 3e4,
    "rangePx": 0,
    "baseUses": 3,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "salted_vial",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "bone_clasp_mask": {
    "id": "bone_clasp_mask",
    "class": "core",
    "familyId": "resistance",
    "grade": 2,
    "name": "\u9AA8\u6263\u9762\u7F69",
    "description": "30\u79D2\u5185\u6297\u6C61\u589E\u52A030",
    "paramKey": "contamination_resistance_points",
    "paramValue": 30,
    "durationMs": 3e4,
    "rangePx": 0,
    "baseUses": 3,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "bone_clasp_mask",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "lead_fastened_breastplate": {
    "id": "lead_fastened_breastplate",
    "class": "core",
    "familyId": "resistance",
    "grade": 3,
    "name": "\u94C5\u6263\u62A4\u80F8",
    "description": "30\u79D2\u5185\u6297\u6C61\u589E\u52A040",
    "paramKey": "contamination_resistance_points",
    "paramValue": 40,
    "durationMs": 3e4,
    "rangePx": 0,
    "baseUses": 3,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "lead_fastened_breastplate",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "split_heel_boot": {
    "id": "split_heel_boot",
    "class": "core",
    "familyId": "dash",
    "grade": 1,
    "name": "\u65AD\u8DDF\u77ED\u9774",
    "description": "\u6CBF\u53EF\u8D70\u5730\u9762\u77ED\u51B248\u50CF\u7D20",
    "paramKey": "dash_distance_px",
    "paramValue": 48,
    "durationMs": 200,
    "rangePx": 48,
    "baseUses": 3,
    "weight": 20,
    "slot": "active",
    "scope": "instant",
    "iconId": "split_heel_boot",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "coiled_tape_measure": {
    "id": "coiled_tape_measure",
    "class": "core",
    "familyId": "dash",
    "grade": 2,
    "name": "\u56DE\u5377\u5C3A",
    "description": "\u6CBF\u53EF\u8D70\u5730\u9762\u77ED\u51B272\u50CF\u7D20",
    "paramKey": "dash_distance_px",
    "paramValue": 72,
    "durationMs": 200,
    "rangePx": 72,
    "baseUses": 3,
    "weight": 20,
    "slot": "active",
    "scope": "instant",
    "iconId": "coiled_tape_measure",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "hollow_loom_shuttle": {
    "id": "hollow_loom_shuttle",
    "class": "core",
    "familyId": "dash",
    "grade": 3,
    "name": "\u7A7A\u5FC3\u68AD",
    "description": "\u6CBF\u53EF\u8D70\u5730\u9762\u77ED\u51B296\u50CF\u7D20",
    "paramKey": "dash_distance_px",
    "paramValue": 96,
    "durationMs": 200,
    "rangePx": 96,
    "baseUses": 3,
    "weight": 20,
    "slot": "active",
    "scope": "instant",
    "iconId": "hollow_loom_shuttle",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "gray_felt_glove": {
    "id": "gray_felt_glove",
    "class": "core",
    "familyId": "silence",
    "grade": 1,
    "name": "\u7070\u6BE1\u624B\u5957",
    "description": "5\u79D2\u5185\u81EA\u8EAB\u884C\u52A8\u6D88\u58F0",
    "paramKey": "silence_duration_ms",
    "paramValue": 5e3,
    "durationMs": 5e3,
    "rangePx": 0,
    "baseUses": 5,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "gray_felt_glove",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "scorched_scarf": {
    "id": "scorched_scarf",
    "class": "core",
    "familyId": "silence",
    "grade": 2,
    "name": "\u7126\u8FB9\u56F4\u5DFE",
    "description": "8\u79D2\u5185\u81EA\u8EAB\u884C\u52A8\u6D88\u58F0",
    "paramKey": "silence_duration_ms",
    "paramValue": 8e3,
    "durationMs": 8e3,
    "rangePx": 0,
    "baseUses": 5,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "scorched_scarf",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "unlined_coat": {
    "id": "unlined_coat",
    "class": "core",
    "familyId": "silence",
    "grade": 3,
    "name": "\u8131\u886C\u98CE\u8863",
    "description": "11\u79D2\u5185\u81EA\u8EAB\u884C\u52A8\u6D88\u58F0",
    "paramKey": "silence_duration_ms",
    "paramValue": 11e3,
    "durationMs": 11e3,
    "rangePx": 0,
    "baseUses": 5,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "unlined_coat",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "split_tongue_bell": {
    "id": "split_tongue_bell",
    "class": "core",
    "familyId": "sound_lure",
    "grade": 1,
    "name": "\u88C2\u820C\u94DC\u94C3",
    "description": "\u629B\u51FA\u58F0\u8BF1\u9975\u6301\u7EED4\u79D2",
    "paramKey": "lure_duration_ms",
    "paramValue": 4e3,
    "durationMs": 4e3,
    "rangePx": 96,
    "baseUses": 5,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "split_tongue_bell",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "crooked_clay_whistle": {
    "id": "crooked_clay_whistle",
    "class": "core",
    "familyId": "sound_lure",
    "grade": 2,
    "name": "\u5F2F\u9888\u9676\u54E8",
    "description": "\u629B\u51FA\u58F0\u8BF1\u9975\u6301\u7EED6\u79D2",
    "paramKey": "lure_duration_ms",
    "paramValue": 6e3,
    "durationMs": 6e3,
    "rangePx": 96,
    "baseUses": 5,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "crooked_clay_whistle",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "missing_tooth_music_box": {
    "id": "missing_tooth_music_box",
    "class": "core",
    "familyId": "sound_lure",
    "grade": 3,
    "name": "\u7F3A\u9F7F\u516B\u97F3\u76D2",
    "description": "\u629B\u51FA\u58F0\u8BF1\u9975\u6301\u7EED8\u79D2",
    "paramKey": "lure_duration_ms",
    "paramValue": 8e3,
    "durationMs": 8e3,
    "rangePx": 96,
    "baseUses": 5,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "missing_tooth_music_box",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "crooked_hook_needle": {
    "id": "crooked_hook_needle",
    "class": "core",
    "familyId": "tripwire",
    "grade": 1,
    "name": "\u5F2F\u5934\u94A9\u9488",
    "description": "\u94FA\u7EBF\u7ECA\u505C\u8DE8\u7EBF\u654C\u4EBA1\u79D2",
    "paramKey": "crossing_stop_ms",
    "paramValue": 1e3,
    "durationMs": 1e4,
    "rangePx": 32,
    "baseUses": 4,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "crooked_hook_needle",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "wooden_thread_spool": {
    "id": "wooden_thread_spool",
    "class": "core",
    "familyId": "tripwire",
    "grade": 2,
    "name": "\u6728\u82AF\u7EBF\u8F74",
    "description": "\u94FA\u7EBF\u7ECA\u505C\u8DE8\u7EBF\u654C\u4EBA1.5\u79D2",
    "paramKey": "crossing_stop_ms",
    "paramValue": 1500,
    "durationMs": 1e4,
    "rangePx": 32,
    "baseUses": 4,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "wooden_thread_spool",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "double_clasp_strap": {
    "id": "double_clasp_strap",
    "class": "core",
    "familyId": "tripwire",
    "grade": 3,
    "name": "\u53CC\u6263\u675F\u5E26",
    "description": "\u94FA\u7EBF\u7ECA\u505C\u8DE8\u7EBF\u654C\u4EBA2\u79D2",
    "paramKey": "crossing_stop_ms",
    "paramValue": 2e3,
    "durationMs": 1e4,
    "rangePx": 32,
    "baseUses": 4,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "double_clasp_strap",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "lead_type_stamp": {
    "id": "lead_type_stamp",
    "class": "core",
    "familyId": "slow_zone",
    "grade": 1,
    "name": "\u94C5\u5B57\u5370\u7AE0",
    "description": "\u811A\u4E0B\u91CD\u533A\u4F7F\u654C\u79FB\u901F\u51CF30%",
    "paramKey": "enemy_movement_multiplier",
    "paramValue": 0.7,
    "durationMs": 6e3,
    "rangePx": 64,
    "baseUses": 4,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "lead_type_stamp",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "broken_eye_scale_weight": {
    "id": "broken_eye_scale_weight",
    "class": "core",
    "familyId": "slow_zone",
    "grade": 2,
    "name": "\u65AD\u8033\u79E4\u7823",
    "description": "\u811A\u4E0B\u91CD\u533A\u4F7F\u654C\u79FB\u901F\u51CF45%",
    "paramKey": "enemy_movement_multiplier",
    "paramValue": 0.55,
    "durationMs": 6e3,
    "rangePx": 64,
    "baseUses": 4,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "broken_eye_scale_weight",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "waterlogged_spine": {
    "id": "waterlogged_spine",
    "class": "core",
    "familyId": "slow_zone",
    "grade": 3,
    "name": "\u6C89\u6C34\u810A\u9AA8",
    "description": "\u811A\u4E0B\u91CD\u533A\u4F7F\u654C\u79FB\u901F\u51CF60%",
    "paramKey": "enemy_movement_multiplier",
    "paramValue": 0.4,
    "durationMs": 6e3,
    "rangePx": 64,
    "baseUses": 4,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "waterlogged_spine",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "silver_back_hand_mirror": {
    "id": "silver_back_hand_mirror",
    "class": "core",
    "familyId": "image_lure",
    "grade": 1,
    "name": "\u94F6\u80CC\u8896\u955C",
    "description": "\u539F\u5730\u7559\u4E0B\u5047\u8EAB5\u79D2",
    "paramKey": "lure_duration_ms",
    "paramValue": 5e3,
    "durationMs": 5e3,
    "rangePx": 0,
    "baseUses": 4,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "silver_back_hand_mirror",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "empty_photo_frame": {
    "id": "empty_photo_frame",
    "class": "core",
    "familyId": "image_lure",
    "grade": 2,
    "name": "\u7A7A\u767D\u76F8\u6846",
    "description": "\u539F\u5730\u7559\u4E0B\u5047\u8EAB8\u79D2",
    "paramKey": "lure_duration_ms",
    "paramValue": 8e3,
    "durationMs": 8e3,
    "rangePx": 0,
    "baseUses": 4,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "empty_photo_frame",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "inverted_face_mask": {
    "id": "inverted_face_mask",
    "class": "core",
    "familyId": "image_lure",
    "grade": 3,
    "name": "\u5012\u8138\u9762\u5177",
    "description": "\u539F\u5730\u7559\u4E0B\u5047\u8EAB11\u79D2",
    "paramKey": "lure_duration_ms",
    "paramValue": 11e3,
    "durationMs": 11e3,
    "rangePx": 0,
    "baseUses": 4,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "inverted_face_mask",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "blind_needle_compass": {
    "id": "blind_needle_compass",
    "class": "core",
    "familyId": "survey",
    "grade": 1,
    "name": "\u76F2\u9488\u7F57\u76D8",
    "description": "\u63A2\u67E54\u683C\u5185\u76EE\u6807\u4F4D\u7F6E",
    "paramKey": "snapshot_path_range_px",
    "paramValue": 128,
    "durationMs": 6e3,
    "rangePx": 128,
    "baseUses": 3,
    "weight": 20,
    "slot": "active",
    "scope": "snapshot",
    "iconId": "blind_needle_compass",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "creased_negative": {
    "id": "creased_negative",
    "class": "core",
    "familyId": "survey",
    "grade": 2,
    "name": "\u6298\u89D2\u5E95\u7247",
    "description": "\u63A2\u67E55\u683C\u5185\u76EE\u6807\u4F4D\u7F6E",
    "paramKey": "snapshot_path_range_px",
    "paramValue": 160,
    "durationMs": 6e3,
    "rangePx": 160,
    "baseUses": 3,
    "weight": 20,
    "slot": "active",
    "scope": "snapshot",
    "iconId": "creased_negative",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "one_eyed_puppet_head": {
    "id": "one_eyed_puppet_head",
    "class": "core",
    "familyId": "survey",
    "grade": 3,
    "name": "\u72EC\u76EE\u5076\u9996",
    "description": "\u63A2\u67E56\u683C\u5185\u76EE\u6807\u4F4D\u7F6E",
    "paramKey": "snapshot_path_range_px",
    "paramValue": 192,
    "durationMs": 6e3,
    "rangePx": 192,
    "baseUses": 3,
    "weight": 20,
    "slot": "active",
    "scope": "snapshot",
    "iconId": "one_eyed_puppet_head",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "cold_ash_pipe": {
    "id": "cold_ash_pipe",
    "class": "core",
    "familyId": "suppress",
    "grade": 1,
    "name": "\u51B7\u7070\u70DF\u6597",
    "description": "\u538B\u4F4F\u4E00\u5904\u6C61\u67D3\u6E903\u79D2",
    "paramKey": "suppression_duration_ms",
    "paramValue": 3e3,
    "durationMs": 3e3,
    "rangePx": 128,
    "baseUses": 3,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "cold_ash_pipe",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "ceramic_charcoal_box": {
    "id": "ceramic_charcoal_box",
    "class": "core",
    "familyId": "suppress",
    "grade": 2,
    "name": "\u9676\u58C1\u70AD\u76D2",
    "description": "\u538B\u4F4F\u4E00\u5904\u6C61\u67D3\u6E905\u79D2",
    "paramKey": "suppression_duration_ms",
    "paramValue": 5e3,
    "durationMs": 5e3,
    "rangePx": 128,
    "baseUses": 3,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "ceramic_charcoal_box",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "frosted_furnace_core": {
    "id": "frosted_furnace_core",
    "class": "core",
    "familyId": "suppress",
    "grade": 3,
    "name": "\u7ED3\u971C\u7089\u82AF",
    "description": "\u538B\u4F4F\u4E00\u5904\u6C61\u67D3\u6E907\u79D2",
    "paramKey": "suppression_duration_ms",
    "paramValue": 7e3,
    "durationMs": 7e3,
    "rangePx": 128,
    "baseUses": 3,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "frosted_furnace_core",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "brass_back_buckle": {
    "id": "brass_back_buckle",
    "class": "core",
    "familyId": "capacity",
    "grade": 1,
    "name": "\u9EC4\u94DC\u80CC\u6263",
    "description": "\u672C\u8D9F\u8D1F\u91CD\u4E0A\u9650\u589E\u52A04",
    "paramKey": "carry_capacity_bonus",
    "paramValue": 4,
    "durationMs": 0,
    "rangePx": 0,
    "baseUses": 2,
    "weight": 20,
    "slot": "passive",
    "scope": "run",
    "iconId": "brass_back_buckle",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "wrinkled_bottom_satchel": {
    "id": "wrinkled_bottom_satchel",
    "class": "core",
    "familyId": "capacity",
    "grade": 2,
    "name": "\u76B1\u5E95\u630E\u5305",
    "description": "\u672C\u8D9F\u8D1F\u91CD\u4E0A\u9650\u589E\u52A06",
    "paramKey": "carry_capacity_bonus",
    "paramValue": 6,
    "durationMs": 0,
    "rangePx": 0,
    "baseUses": 2,
    "weight": 20,
    "slot": "passive",
    "scope": "run",
    "iconId": "wrinkled_bottom_satchel",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "reverse_woven_basket": {
    "id": "reverse_woven_basket",
    "class": "core",
    "familyId": "capacity",
    "grade": 3,
    "name": "\u53CD\u7F16\u85E4\u7BEE",
    "description": "\u672C\u8D9F\u8D1F\u91CD\u4E0A\u9650\u589E\u52A08",
    "paramKey": "carry_capacity_bonus",
    "paramValue": 8,
    "durationMs": 0,
    "rangePx": 0,
    "baseUses": 2,
    "weight": 20,
    "slot": "passive",
    "scope": "run",
    "iconId": "reverse_woven_basket",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "wax_sealed_button": {
    "id": "wax_sealed_button",
    "class": "weak",
    "familyId": "solidify",
    "grade": 0,
    "name": "\u8721\u5C01\u7EBD\u6263",
    "description": "\u505C\u4F4F\u4E00\u654C1\u79D2\uFF1B\u53D7\u4F24\u89E3\u9664",
    "paramKey": "freeze_duration_ms",
    "paramValue": 1e3,
    "durationMs": 1e3,
    "rangePx": 128,
    "baseUses": 5,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "wax_sealed_button",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "clouded_lens": {
    "id": "clouded_lens",
    "class": "weak",
    "familyId": "sight",
    "grade": 0,
    "name": "\u96FE\u6591\u955C\u7247",
    "description": "\u672C\u8D9F\u89C6\u8DDD\u589E\u52A05%",
    "paramKey": "vision_radius_multiplier",
    "paramValue": 1.05,
    "durationMs": 0,
    "rangePx": 0,
    "baseUses": 2,
    "weight": 20,
    "slot": "passive",
    "scope": "run",
    "iconId": "clouded_lens",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "ceramic_capsule": {
    "id": "ceramic_capsule",
    "class": "weak",
    "familyId": "resistance",
    "grade": 0,
    "name": "\u9676\u8863\u836F\u4E38",
    "description": "30\u79D2\u5185\u6297\u6C61\u589E\u52A010",
    "paramKey": "contamination_resistance_points",
    "paramValue": 10,
    "durationMs": 3e4,
    "rangePx": 0,
    "baseUses": 3,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "ceramic_capsule",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "hollow_reed_joint": {
    "id": "hollow_reed_joint",
    "class": "weak",
    "familyId": "sound_lure",
    "grade": 0,
    "name": "\u7A7A\u8282\u82C7\u7BA1",
    "description": "\u629B\u51FA\u58F0\u8BF1\u9975\u6301\u7EED2\u79D2",
    "paramKey": "lure_duration_ms",
    "paramValue": 2e3,
    "durationMs": 2e3,
    "rangePx": 96,
    "baseUses": 5,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "hollow_reed_joint",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "sunken_inkstone": {
    "id": "sunken_inkstone",
    "class": "weak",
    "familyId": "slow_zone",
    "grade": 0,
    "name": "\u51F9\u5FC3\u781A\u53F0",
    "description": "\u811A\u4E0B\u91CD\u533A\u4F7F\u654C\u79FB\u901F\u51CF10%",
    "paramKey": "enemy_movement_multiplier",
    "paramValue": 0.9,
    "durationMs": 6e3,
    "rangePx": 64,
    "baseUses": 4,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "sunken_inkstone",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "hollow_eyelet": {
    "id": "hollow_eyelet",
    "class": "weak",
    "familyId": "survey",
    "grade": 0,
    "name": "\u7A7A\u773C\u94DC\u73AF",
    "description": "\u63A2\u67E52\u683C\u5185\u76EE\u6807\u4F4D\u7F6E",
    "paramKey": "snapshot_path_range_px",
    "paramValue": 64,
    "durationMs": 6e3,
    "rangePx": 64,
    "baseUses": 3,
    "weight": 20,
    "slot": "active",
    "scope": "snapshot",
    "iconId": "hollow_eyelet",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "ash_tooth": {
    "id": "ash_tooth",
    "class": "weak",
    "familyId": "suppress",
    "grade": 0,
    "name": "\u7070\u91C9\u9F7F",
    "description": "\u538B\u4F4F\u4E00\u5904\u6C61\u67D3\u6E901\u79D2",
    "paramKey": "suppression_duration_ms",
    "paramValue": 1e3,
    "durationMs": 1e3,
    "rangePx": 128,
    "baseUses": 3,
    "weight": 20,
    "slot": "active",
    "scope": "timed",
    "iconId": "ash_tooth",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "creased_ticket_wallet": {
    "id": "creased_ticket_wallet",
    "class": "weak",
    "familyId": "capacity",
    "grade": 0,
    "name": "\u6298\u9875\u7968\u5939",
    "description": "\u672C\u8D9F\u8D1F\u91CD\u4E0A\u9650\u589E\u52A02",
    "paramKey": "carry_capacity_bonus",
    "paramValue": 2,
    "durationMs": 0,
    "rangePx": 0,
    "baseUses": 2,
    "weight": 10,
    "slot": "passive",
    "scope": "run",
    "iconId": "creased_ticket_wallet",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "double_hole_token": {
    "id": "double_hole_token",
    "class": "inert",
    "familyId": null,
    "grade": 0,
    "name": "\u53CC\u5B54\u7968\u724C",
    "description": "\u6CA1\u6709\u53EF\u7528\u7684\u88C2\u9699\u80FD\u529B",
    "paramKey": "",
    "paramValue": 0,
    "durationMs": 0,
    "rangePx": 0,
    "baseUses": 0,
    "weight": 20,
    "slot": null,
    "scope": null,
    "iconId": "double_hole_token",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "sealed_flower_calyx": {
    "id": "sealed_flower_calyx",
    "class": "inert",
    "familyId": null,
    "grade": 0,
    "name": "\u5C01\u53E3\u82B1\u843C",
    "description": "\u6CA1\u6709\u53EF\u7528\u7684\u88C2\u9699\u80FD\u529B",
    "paramKey": "",
    "paramValue": 0,
    "durationMs": 0,
    "rangePx": 0,
    "baseUses": 0,
    "weight": 20,
    "slot": null,
    "scope": null,
    "iconId": "sealed_flower_calyx",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "split_porcelain_spoon": {
    "id": "split_porcelain_spoon",
    "class": "inert",
    "familyId": null,
    "grade": 0,
    "name": "\u5206\u53C9\u74F7\u5319",
    "description": "\u6CA1\u6709\u53EF\u7528\u7684\u88C2\u9699\u80FD\u529B",
    "paramKey": "",
    "paramValue": 0,
    "durationMs": 0,
    "rangePx": 0,
    "baseUses": 0,
    "weight": 20,
    "slot": null,
    "scope": null,
    "iconId": "split_porcelain_spoon",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  },
  "paper_spiral": {
    "id": "paper_spiral",
    "class": "inert",
    "familyId": null,
    "grade": 0,
    "name": "\u6298\u7EB8\u87BA",
    "description": "\u6CA1\u6709\u53EF\u7528\u7684\u88C2\u9699\u80FD\u529B",
    "paramKey": "",
    "paramValue": 0,
    "durationMs": 0,
    "rangePx": 0,
    "baseUses": 0,
    "weight": 20,
    "slot": null,
    "scope": null,
    "iconId": "paper_spiral",
    "enabled": true,
    "contentVersion": "contaminant-v1"
  }
};
var CATALOG_OFFERINGS = {
  "resist_25": {
    "id": "resist_25",
    "name": "\u8FDF\u6EDE\u53CD\u5E94",
    "effect": "impact_damage_reduction",
    "amount": 0.25,
    "chargeMultiplier": 1,
    "selectionWeight": 30,
    "description": "\u4F9B\u5949\u671F\u95F4\u51B2\u51FB\u4F24\u5BB3\u51CF\u5C1125%"
  },
  "resist_35": {
    "id": "resist_35",
    "name": "\u6392\u65A5\u53CD\u5E94",
    "effect": "impact_damage_reduction",
    "amount": 0.35,
    "chargeMultiplier": 1,
    "selectionWeight": 30,
    "description": "\u4F9B\u5949\u671F\u95F4\u51B2\u51FB\u4F24\u5BB3\u51CF\u5C1135%"
  },
  "resist_45": {
    "id": "resist_45",
    "name": "\u9694\u65AD\u53CD\u5E94",
    "effect": "impact_damage_reduction",
    "amount": 0.45,
    "chargeMultiplier": 1,
    "selectionWeight": 20,
    "description": "\u4F9B\u5949\u671F\u95F4\u51B2\u51FB\u4F24\u5BB3\u51CF\u5C1145%"
  },
  "quickening": {
    "id": "quickening",
    "name": "\u4FC3\u53D8\u53CD\u5E94",
    "effect": "self_charge_multiplier",
    "amount": 2,
    "chargeMultiplier": 2,
    "selectionWeight": 10,
    "description": "\u81EA\u8EAB\u4F9B\u5949\u79EF\u7D2F\u7FFB\u500D\uFF1B\u4E0D\u63D0\u4F9B\u51CF\u4F24"
  },
  "quiet": {
    "id": "quiet",
    "name": "\u6C89\u9ED8\u53CD\u5E94",
    "effect": "none",
    "amount": 0,
    "chargeMultiplier": 1,
    "selectionWeight": 10,
    "description": "\u4E0D\u63D0\u4F9B\u4F9B\u5949\u589E\u76CA\uFF1B\u4ECD\u53EF\u8F6C\u5316\u63ED\u6653"
  }
};
var CATALOG_APPEARANCES = {
  "wax_parcel": {
    "id": "wax_parcel",
    "name": "\u8721\u5C01\u5305",
    "weight": 20,
    "selectionWeight": 1,
    "iconId": "wax_parcel",
    "compatiblePool": "all_enabled"
  },
  "resin_nodule": {
    "id": "resin_nodule",
    "name": "\u6811\u8102\u56E2",
    "weight": 20,
    "selectionWeight": 1,
    "iconId": "resin_nodule",
    "compatiblePool": "all_enabled"
  },
  "ash_cocoon": {
    "id": "ash_cocoon",
    "name": "\u7070\u7ED3\u8327",
    "weight": 20,
    "selectionWeight": 1,
    "iconId": "ash_cocoon",
    "compatiblePool": "all_enabled"
  },
  "layered_hide": {
    "id": "layered_hide",
    "name": "\u53E0\u76AE\u56CA",
    "weight": 20,
    "selectionWeight": 1,
    "iconId": "layered_hide",
    "compatiblePool": "all_enabled"
  },
  "ceramic_seal": {
    "id": "ceramic_seal",
    "name": "\u9676\u5C01\u5757",
    "weight": 20,
    "selectionWeight": 1,
    "iconId": "ceramic_seal",
    "compatiblePool": "all_enabled"
  },
  "salt_case": {
    "id": "salt_case",
    "name": "\u76D0\u58F3\u5323",
    "weight": 20,
    "selectionWeight": 1,
    "iconId": "salt_case",
    "compatiblePool": "all_enabled"
  },
  "stitched_pouch": {
    "id": "stitched_pouch",
    "name": "\u7F1D\u5408\u5E03\u56CA",
    "weight": 20,
    "selectionWeight": 1,
    "iconId": "stitched_pouch",
    "compatiblePool": "all_enabled"
  },
  "thin_shell_ovoid": {
    "id": "thin_shell_ovoid",
    "name": "\u8584\u58F3\u5375",
    "weight": 20,
    "selectionWeight": 1,
    "iconId": "thin_shell_ovoid",
    "compatiblePool": "all_enabled"
  }
};
var CATALOG_LOOT_PROFILES = {
  "safe": {
    "id": "safe",
    "coreWeight": 65,
    "weakWeight": 25,
    "inertWeight": 10,
    "gradeWeights": [
      80,
      18,
      2
    ],
    "globalFamilyMix": 0.6
  },
  "contested": {
    "id": "contested",
    "coreWeight": 65,
    "weakWeight": 25,
    "inertWeight": 10,
    "gradeWeights": [
      60,
      32,
      8
    ],
    "globalFamilyMix": 0.6
  },
  "deep": {
    "id": "deep",
    "coreWeight": 65,
    "weakWeight": 25,
    "inertWeight": 10,
    "gradeWeights": [
      40,
      42,
      18
    ],
    "globalFamilyMix": 0.6
  }
};
var CATALOG_SOURCE_AFFINITIES = {
  "unbiased": [
    {
      "familyId": "solidify",
      "weight": 1,
      "publicHint": "\u6B8B\u7559\u7279\u5F81\u6DF7\u6742",
      "sourceLabel": "\u6DF7\u6742"
    },
    {
      "familyId": "sight",
      "weight": 1,
      "publicHint": "\u6B8B\u7559\u7279\u5F81\u6DF7\u6742",
      "sourceLabel": "\u6DF7\u6742"
    },
    {
      "familyId": "resistance",
      "weight": 1,
      "publicHint": "\u6B8B\u7559\u7279\u5F81\u6DF7\u6742",
      "sourceLabel": "\u6DF7\u6742"
    },
    {
      "familyId": "dash",
      "weight": 1,
      "publicHint": "\u6B8B\u7559\u7279\u5F81\u6DF7\u6742",
      "sourceLabel": "\u6DF7\u6742"
    },
    {
      "familyId": "silence",
      "weight": 1,
      "publicHint": "\u6B8B\u7559\u7279\u5F81\u6DF7\u6742",
      "sourceLabel": "\u6DF7\u6742"
    },
    {
      "familyId": "sound_lure",
      "weight": 1,
      "publicHint": "\u6B8B\u7559\u7279\u5F81\u6DF7\u6742",
      "sourceLabel": "\u6DF7\u6742"
    },
    {
      "familyId": "tripwire",
      "weight": 1,
      "publicHint": "\u6B8B\u7559\u7279\u5F81\u6DF7\u6742",
      "sourceLabel": "\u6DF7\u6742"
    },
    {
      "familyId": "slow_zone",
      "weight": 1,
      "publicHint": "\u6B8B\u7559\u7279\u5F81\u6DF7\u6742",
      "sourceLabel": "\u6DF7\u6742"
    },
    {
      "familyId": "image_lure",
      "weight": 1,
      "publicHint": "\u6B8B\u7559\u7279\u5F81\u6DF7\u6742",
      "sourceLabel": "\u6DF7\u6742"
    },
    {
      "familyId": "survey",
      "weight": 1,
      "publicHint": "\u6B8B\u7559\u7279\u5F81\u6DF7\u6742",
      "sourceLabel": "\u6DF7\u6742"
    },
    {
      "familyId": "suppress",
      "weight": 1,
      "publicHint": "\u6B8B\u7559\u7279\u5F81\u6DF7\u6742",
      "sourceLabel": "\u6DF7\u6742"
    },
    {
      "familyId": "capacity",
      "weight": 1,
      "publicHint": "\u6B8B\u7559\u7279\u5F81\u6DF7\u6742",
      "sourceLabel": "\u6DF7\u6742"
    }
  ],
  "optical": [
    {
      "familyId": "sight",
      "weight": 1,
      "publicHint": "\u591A\u89C1\u4E0E\u89C2\u5BDF\u6709\u5173\u7684\u6B8B\u7559",
      "sourceLabel": "\u5149\u5B66"
    },
    {
      "familyId": "survey",
      "weight": 1,
      "publicHint": "\u591A\u89C1\u4E0E\u89C2\u5BDF\u6709\u5173\u7684\u6B8B\u7559",
      "sourceLabel": "\u5149\u5B66"
    }
  ],
  "acoustic": [
    {
      "familyId": "silence",
      "weight": 1,
      "publicHint": "\u591A\u89C1\u4F1A\u6539\u53D8\u58F0\u97F3\u7684\u6B8B\u7559",
      "sourceLabel": "\u58F0\u5B66"
    },
    {
      "familyId": "sound_lure",
      "weight": 1,
      "publicHint": "\u591A\u89C1\u4F1A\u6539\u53D8\u58F0\u97F3\u7684\u6B8B\u7559",
      "sourceLabel": "\u58F0\u5B66"
    }
  ],
  "tension": [
    {
      "familyId": "dash",
      "weight": 1,
      "publicHint": "\u591A\u89C1\u6539\u53D8\u7275\u62C9\u4E0E\u4F4D\u79FB\u7684\u6B8B\u7559",
      "sourceLabel": "\u5F20\u529B"
    },
    {
      "familyId": "tripwire",
      "weight": 1,
      "publicHint": "\u591A\u89C1\u6539\u53D8\u7275\u62C9\u4E0E\u4F4D\u79FB\u7684\u6B8B\u7559",
      "sourceLabel": "\u5F20\u529B"
    }
  ],
  "density": [
    {
      "familyId": "slow_zone",
      "weight": 1,
      "publicHint": "\u591A\u89C1\u6539\u53D8\u91CD\u91CF\u7684\u6B8B\u7559",
      "sourceLabel": "\u5BC6\u5EA6"
    },
    {
      "familyId": "capacity",
      "weight": 1,
      "publicHint": "\u591A\u89C1\u6539\u53D8\u91CD\u91CF\u7684\u6B8B\u7559",
      "sourceLabel": "\u5BC6\u5EA6"
    }
  ],
  "inhibition": [
    {
      "familyId": "resistance",
      "weight": 1,
      "publicHint": "\u591A\u89C1\u538B\u4F4F\u4FB5\u8680\u7684\u6B8B\u7559",
      "sourceLabel": "\u6291\u5236"
    },
    {
      "familyId": "suppress",
      "weight": 1,
      "publicHint": "\u591A\u89C1\u538B\u4F4F\u4FB5\u8680\u7684\u6B8B\u7559",
      "sourceLabel": "\u6291\u5236"
    }
  ],
  "imprint": [
    {
      "familyId": "solidify",
      "weight": 1,
      "publicHint": "\u591A\u89C1\u7559\u4F4F\u5F62\u8FF9\u7684\u6B8B\u7559",
      "sourceLabel": "\u5370\u75D5"
    },
    {
      "familyId": "image_lure",
      "weight": 1,
      "publicHint": "\u591A\u89C1\u7559\u4F4F\u5F62\u8FF9\u7684\u6B8B\u7559",
      "sourceLabel": "\u5370\u75D5"
    }
  ]
};
var CATALOG_QUALITIES = {
  "ordinary": {
    "id": "ordinary",
    "name": "\u666E\u901A",
    "rank": 1,
    "extraUses": 0,
    "weight": 60
  },
  "good": {
    "id": "good",
    "name": "\u4F18\u826F",
    "rank": 2,
    "extraUses": 1,
    "weight": 25
  },
  "fine": {
    "id": "fine",
    "name": "\u7CBE\u826F",
    "rank": 3,
    "extraUses": 2,
    "weight": 12
  },
  "excellent": {
    "id": "excellent",
    "name": "\u5353\u8D8A",
    "rank": 4,
    "extraUses": 3,
    "weight": 3
  }
};
var INVENTORY_RULES = {
  "carry_capacity_tenths": 160,
  "contaminant_weight_tenths": 20
};

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/generated/weapon-data.ts
var WEAPON_DATA = {
  "crowbar_plain": {
    "id": "crowbar_plain",
    "name": "\u666E\u901A\u64AC\u68CD",
    "type": "crowbar",
    "profileId": "crowbar",
    "quality": "ordinary",
    "qualityName": "\u666E\u901A",
    "qualityRank": 1,
    "variant": "standard",
    "offeringCharges": 3,
    "maxUses": 60,
    "weight": 30,
    "damageMin": 22,
    "damageMax": 28,
    "damage": 25,
    "pollutionResistance": 0,
    "visualKey": "plain_iron"
  },
  "crowbar_good_standard": {
    "id": "crowbar_good_standard",
    "name": "\u4F18\u826F\u64AC\u68CD",
    "type": "crowbar",
    "profileId": "crowbar",
    "quality": "good",
    "qualityName": "\u4F18\u826F",
    "qualityRank": 2,
    "variant": "standard",
    "offeringCharges": 3,
    "maxUses": 75,
    "weight": 30,
    "damageMin": 29,
    "damageMax": 35,
    "damage": 32,
    "pollutionResistance": 2,
    "visualKey": "good_standard"
  },
  "crowbar_good_light": {
    "id": "crowbar_good_light",
    "name": "\u4F18\u826F\u8F7B\u578B\u64AC\u68CD",
    "type": "crowbar",
    "profileId": "crowbar",
    "quality": "good",
    "qualityName": "\u4F18\u826F",
    "qualityRank": 2,
    "variant": "light",
    "offeringCharges": 3,
    "maxUses": 75,
    "weight": 27,
    "damageMin": 29,
    "damageMax": 35,
    "damage": 32,
    "pollutionResistance": 0,
    "visualKey": "good_light"
  },
  "crowbar_good_resistant": {
    "id": "crowbar_good_resistant",
    "name": "\u4F18\u826F\u6297\u6C61\u64AC\u68CD",
    "type": "crowbar",
    "profileId": "crowbar",
    "quality": "good",
    "qualityName": "\u4F18\u826F",
    "qualityRank": 2,
    "variant": "resistant",
    "offeringCharges": 3,
    "maxUses": 75,
    "weight": 33,
    "damageMin": 29,
    "damageMax": 35,
    "damage": 32,
    "pollutionResistance": 4,
    "visualKey": "good_resistant"
  },
  "crowbar_fine_standard": {
    "id": "crowbar_fine_standard",
    "name": "\u7CBE\u826F\u64AC\u68CD",
    "type": "crowbar",
    "profileId": "crowbar",
    "quality": "fine",
    "qualityName": "\u7CBE\u826F",
    "qualityRank": 3,
    "variant": "standard",
    "offeringCharges": 3,
    "maxUses": 90,
    "weight": 30,
    "damageMin": 36,
    "damageMax": 44,
    "damage": 40,
    "pollutionResistance": 2,
    "visualKey": "fine_standard"
  },
  "crowbar_fine_light": {
    "id": "crowbar_fine_light",
    "name": "\u7CBE\u826F\u8F7B\u578B\u64AC\u68CD",
    "type": "crowbar",
    "profileId": "crowbar",
    "quality": "fine",
    "qualityName": "\u7CBE\u826F",
    "qualityRank": 3,
    "variant": "light",
    "offeringCharges": 3,
    "maxUses": 90,
    "weight": 27,
    "damageMin": 36,
    "damageMax": 44,
    "damage": 40,
    "pollutionResistance": 0,
    "visualKey": "fine_light"
  },
  "crowbar_fine_resistant": {
    "id": "crowbar_fine_resistant",
    "name": "\u7CBE\u826F\u6297\u6C61\u64AC\u68CD",
    "type": "crowbar",
    "profileId": "crowbar",
    "quality": "fine",
    "qualityName": "\u7CBE\u826F",
    "qualityRank": 3,
    "variant": "resistant",
    "offeringCharges": 3,
    "maxUses": 90,
    "weight": 33,
    "damageMin": 36,
    "damageMax": 44,
    "damage": 40,
    "pollutionResistance": 4,
    "visualKey": "fine_resistant"
  },
  "crowbar_excellent_standard": {
    "id": "crowbar_excellent_standard",
    "name": "\u5353\u8D8A\u64AC\u68CD",
    "type": "crowbar",
    "profileId": "crowbar",
    "quality": "excellent",
    "qualityName": "\u5353\u8D8A",
    "qualityRank": 4,
    "variant": "standard",
    "offeringCharges": 3,
    "maxUses": 110,
    "weight": 30,
    "damageMin": 46,
    "damageMax": 56,
    "damage": 51,
    "pollutionResistance": 2,
    "visualKey": "excellent_standard"
  },
  "crowbar_excellent_light": {
    "id": "crowbar_excellent_light",
    "name": "\u5353\u8D8A\u8F7B\u578B\u64AC\u68CD",
    "type": "crowbar",
    "profileId": "crowbar",
    "quality": "excellent",
    "qualityName": "\u5353\u8D8A",
    "qualityRank": 4,
    "variant": "light",
    "offeringCharges": 3,
    "maxUses": 110,
    "weight": 27,
    "damageMin": 46,
    "damageMax": 56,
    "damage": 51,
    "pollutionResistance": 0,
    "visualKey": "excellent_light"
  },
  "crowbar_excellent_resistant": {
    "id": "crowbar_excellent_resistant",
    "name": "\u5353\u8D8A\u6297\u6C61\u64AC\u68CD",
    "type": "crowbar",
    "profileId": "crowbar",
    "quality": "excellent",
    "qualityName": "\u5353\u8D8A",
    "qualityRank": 4,
    "variant": "resistant",
    "offeringCharges": 3,
    "maxUses": 110,
    "weight": 33,
    "damageMin": 46,
    "damageMax": 56,
    "damage": 51,
    "pollutionResistance": 4,
    "visualKey": "excellent_resistant"
  }
};

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/generated/contaminant-data.ts
var CONTAMINANT_DATA = {
  "solidify": {
    active: true,
    toolResistanceBonus: 0,
    toolStopMs: 0,
    toolPlacementDistancePx: 0,
    toolMovementMult: 1,
    defenseRepairBonusHp: 0,
    defenseTransferCap: 0,
    defensePrimaryReduction: 0,
    defenseLowHpThreshold: 0,
    defenseLowHpReduction: 0,
    id: "solidify",
    rarity: "common",
    displayNameDefense: "\u51DD\u6EDE\u7684\u77F3\u5757",
    descriptionDefense: "\u51DD\u6EDE\u7684\u77F3\u5757\u5C06\u51B2\u51FB\u7684\u4E00\u90E8\u5206\u7559\u5728\u505C\u6EDE\u88C2\u9762\u91CC\uFF0C\u51CF\u4F2435%\uFF0C\u65E0\u989D\u5916\u526F\u4F5C\u7528\u3002",
    summaryDefense: "\u51CF\u4F2435%\u3002",
    defenseCategory: "\u7EAF\u51CF\u4F24",
    defenseReduction: 0.35,
    defenseSideEffect: "\u65E0",
    sideEffectDuration: "\u65E0",
    defenseChargeMult: 1,
    defenseSecondaryReduction: 0,
    defenseHealRatio: 0,
    displayNameTool: "\u51DD\u6EDE\u7684\u77F3\u5757",
    descriptionTool: "\u4F7F\u89C6\u91CE\u5185\u65E0\u906E\u6321\u7684\u6700\u8FD1\u5730\u9762\u5B9E\u4F53\u505C\u6EDE4\u79D2\uFF0C\u963B\u6B62\u79FB\u52A8\u3001\u611F\u77E5\u4E0E\u653B\u51FB\u3002\u53D7\u5230\u4F24\u5BB3\u540E\u63D0\u524D\u89E3\u9664\uFF1B\u91CD\u65B0\u51FA\u624B\u987B\u5B8C\u6574\u9884\u5146\u3002\u4E0D\u4F5C\u7528\u4E8E\u5360\u6F06\u6216\u5360\u7A7A\u573A\u57DF\u3002",
    summaryTool: "\u505C\u6EDE4\u79D2\uFF0C\u53D7\u4F24\u89E3\u9664\u3002",
    toolType: "active",
    toolUses: 5,
    toolRangePx: 0,
    toolDurationMs: 4e3,
    toolDetectionFillMult: 1,
    toolThrowDistancePx: 0,
    toolPulseIntervalMs: 0,
    narrativeOrigin: "\u51B0\u51B7\u7684\u7ED3\u5757\uFF0C\u88C2\u9762\u91CC\u6EDE\u7559\u7740\u5C1A\u672A\u843D\u4E0B\u7684\u5C18\u57C3\u3002"
  },
  "ruminate": {
    active: false,
    toolResistanceBonus: 0,
    toolStopMs: 0,
    toolPlacementDistancePx: 0,
    toolMovementMult: 1,
    defenseRepairBonusHp: 0,
    defenseTransferCap: 0,
    defensePrimaryReduction: 0,
    defenseLowHpThreshold: 0,
    defenseLowHpReduction: 0,
    id: "ruminate",
    rarity: "common",
    displayNameDefense: "\u566C\u5316\u6B8B\u6E23",
    descriptionDefense: "\u6765\u81EA\u541E\u566C\u65F6\u7A7A\u7684\u6D88\u5316\u788E\u7247\u3002\u541E\u98DF\u51B2\u51FB\u80FD\u91CF\u51CF\u4F2430%\u5E76\u5C06\u541E\u98DF\u7684\u80FD\u91CF\u4EE3\u8C22\u4E3A2\u85AA\u67F4\u8FD4\u8FD8\u50A8\u5907\u3002\u88AB\u6253\u4E86\u4F46\u56DE\u6536\u4E86\u4E00\u90E8\u5206\u8D44\u6E90\u3002",
    summaryDefense: "\u51CF\u4F24 30%\u3002\u8FD4\u8FD8 2 \u85AA\u67F4\u3002",
    defenseCategory: "\u7ECF\u6D4E\u6536\u76CA",
    defenseReduction: 0.3,
    defenseSideEffect: "\u4E0B\u6B21\u51FA\u51FB\u521D\u59CB\u6DF7\u4E71+5",
    sideEffectDuration: "1\u6B21\u51FA\u51FB",
    defenseChargeMult: 1.5,
    defenseSecondaryReduction: 0,
    defenseHealRatio: 0,
    displayNameTool: "\u53CD\u520D\u4E4B\u53E3",
    descriptionTool: "\u5BF9\u811A\u4E0B\u5DF2\u62FE\u53D6\u8FC7\u7684\u7A7A\u85AA\u67F4\u8282\u70B9\u53D1\u52A8\u6D88\u5316\u4ECE\u4E2D\u56DE\u65361\u70B9\u85AA\u67F4\u3002\u4E0D\u53EF\u5BF9\u540C\u4E00\u8282\u70B9\u91CD\u590D\u4F7F\u7528\u3002",
    summaryTool: "\u4ECE\u7A7A\u8282\u70B9\u56DE\u6536 1 \u85AA\u67F4\u3002",
    toolType: "active",
    toolUses: 4,
    toolRangePx: 96,
    toolDurationMs: 0,
    toolDetectionFillMult: 1,
    toolThrowDistancePx: 0,
    toolPulseIntervalMs: 0,
    narrativeOrigin: "\u541E\u566C\u8986\u76D6\u65F6\u7A7A\u2014\u2014\u901A\u8FC7\u6D88\u5316\u6269\u5F20"
  },
  "scatter": {
    active: true,
    toolResistanceBonus: 0,
    toolStopMs: 0,
    toolPlacementDistancePx: 0,
    toolMovementMult: 1,
    defenseRepairBonusHp: 0,
    defenseTransferCap: 0,
    defensePrimaryReduction: 0,
    defenseLowHpThreshold: 0,
    defenseLowHpReduction: 0,
    id: "scatter",
    rarity: "common",
    displayNameDefense: "\u91CD\u5F71\u788E\u7247",
    descriptionDefense: "\u5C06\u96C6\u4E2D\u51B2\u51FB\u5206\u6563\u5230\u5168\u90E8\u6A21\u5757\uFF0C\u603B\u4F24\u5BB3\u4E0D\u51CF\u5C11\uFF0C\u8106\u5F31\u6A21\u5757\u4E5F\u53EF\u80FD\u53D7\u4F24\u3002",
    summaryDefense: "\u51B2\u51FB\u5747\u644A\u81F3\u5168\u90E8\u6A21\u5757\u3002",
    defenseCategory: "\u7EAF\u51CF\u4F24",
    defenseReduction: 0,
    defenseSideEffect: "\u65E0",
    sideEffectDuration: "\u65E0",
    defenseChargeMult: 1,
    defenseSecondaryReduction: 0,
    defenseHealRatio: 0,
    displayNameTool: "\u91CD\u5F71\u788E\u7247",
    descriptionTool: "\u88AB\u52A8\u751F\u6548\u3002\u5F53\u654C\u4EBA\u65B0\u4E00\u6B21\u5F00\u59CB\u6000\u7591\u4F60\u7684\u5B58\u5728\u65F6\uFF0C\u611F\u77E5\u586B\u5145\u901F\u5EA6\u964D\u4F4E30%\u3002\u540C\u4E00\u6000\u7591\u4E8B\u4EF6\u53EA\u6D88\u8017\u4E00\u6B21\u3002",
    summaryTool: "\u88AB\u52A8\u3002\u65B0\u6000\u7591\u586B\u5145\u51CF\u901F30%\u3002",
    toolType: "passive",
    toolUses: 5,
    toolRangePx: 0,
    toolDurationMs: 15e3,
    toolDetectionFillMult: 0.7,
    toolThrowDistancePx: 0,
    toolPulseIntervalMs: 0,
    narrativeOrigin: "\u8584\u7247\u7684\u8FB9\u7F18\u603B\u6BD4\u81EA\u8EAB\u6162\u534A\u62CD\uFF0C\u50CF\u4E00\u4EF6\u6CA1\u6709\u5408\u62E2\u7684\u9057\u7269\u3002"
  },
  "retrograde": {
    active: true,
    toolResistanceBonus: 0,
    toolStopMs: 0,
    toolPlacementDistancePx: 0,
    toolMovementMult: 1,
    defenseRepairBonusHp: 0,
    defenseTransferCap: 0,
    defensePrimaryReduction: 0,
    defenseLowHpThreshold: 0,
    defenseLowHpReduction: 0,
    id: "retrograde",
    rarity: "common",
    displayNameDefense: "\u8BB0\u5FC6\u788E\u7247",
    descriptionDefense: "\u51CF\u4F2415%\u3002\u6BCF\u6B21\u5728\u4F9B\u5949\u4E2D\u627F\u53D7\u51B2\u51FB\u540E\uFF0C\u8BB0\u4E0B\u4E0B\u4E00\u8F6E\u51C6\u786E\u76EE\u6807\u4E0E\u5F3A\u5EA6\uFF1B\u53D6\u4E0B\u6216\u6210\u719F\u540E\u672C\u6B21\u8BB0\u5F55\u4ECD\u6709\u6548\u3002",
    summaryDefense: "\u51CF\u4F2415%\uFF0C\u5F52\u6765\u8BB0\u4E0B\u9884\u544A\u3002",
    defenseCategory: "\u52A0\u901F/\u50AC\u5316",
    defenseReduction: 0.15,
    defenseSideEffect: "\u65E0",
    sideEffectDuration: "\u65E0",
    defenseChargeMult: 1,
    defenseSecondaryReduction: 0,
    defenseHealRatio: 0,
    displayNameTool: "\u8BB0\u5FC6\u788E\u7247",
    descriptionTool: "\u88AB\u52A8\u751F\u6548\u3002\u65B0\u4E00\u8F6E\u8FFD\u51FB\u4E2D\uFF0C\u654C\u4EBA\u79BB\u5F00\u4F60\u7684\u89C6\u7EBF\u540E\uFF0C\u5728\u6700\u540E\u770B\u89C1\u7684\u4F4D\u7F6E\u7559\u4E0B6\u79D2\u6B8B\u5F71\u3002\u540C\u4E00\u8F6E\u8FFD\u51FB\u53EA\u6D88\u8017\u4E00\u6B21\uFF1B\u4E0D\u8FFD\u8E2A\u89C6\u91CE\u5916\u7684\u5B9E\u65F6\u4F4D\u7F6E\u3002",
    summaryTool: "\u88AB\u52A8\u3002\u5931\u53BB\u89C6\u7EBF\u65F6\u4FDD\u7559\u6700\u540E\u4F4D\u7F6E6\u79D2\u3002",
    toolType: "passive",
    toolUses: 5,
    toolRangePx: 0,
    toolDurationMs: 6e3,
    toolDetectionFillMult: 1,
    toolThrowDistancePx: 0,
    toolPulseIntervalMs: 0,
    narrativeOrigin: "\u523B\u75D5\u4ECE\u65E7\u788E\u7247\u7684\u80CC\u9762\u6D6E\u8D77\uFF0C\u8BB0\u7740\u5C1A\u672A\u5F7B\u5E95\u79BB\u5F00\u7684\u4E1C\u897F\u3002"
  },
  "delay": {
    active: true,
    toolResistanceBonus: 0,
    toolStopMs: 0,
    toolPlacementDistancePx: 0,
    toolMovementMult: 1,
    defenseRepairBonusHp: 0,
    defenseTransferCap: 0,
    defensePrimaryReduction: 0,
    defenseLowHpThreshold: 0,
    defenseLowHpReduction: 0,
    id: "delay",
    rarity: "fine",
    displayNameDefense: "\u4E0D\u843D\u7684\u7802\u783E",
    descriptionDefense: "\u60AC\u4F4F\u7684\u7802\u7C92\u627F\u63A5\u51B2\u51FB\uFF0C\u7A33\u5B9A\u51CF\u4F2430%\u3002",
    summaryDefense: "\u51CF\u4F2430%\u3002",
    defenseCategory: "\u7EAF\u51CF\u4F24",
    defenseReduction: 0.3,
    defenseSideEffect: "\u65E0",
    sideEffectDuration: "\u65E0",
    defenseChargeMult: 1,
    defenseSecondaryReduction: 0,
    defenseHealRatio: 0,
    displayNameTool: "\u4E0D\u843D\u7684\u7802\u783E",
    descriptionTool: "\u63A8\u8FDF\u89C6\u91CE\u5185\u65E0\u906E\u6321\u4E14\u5C1A\u672A\u91CA\u653E\u7684\u6700\u8FD1\u6C14\u56E2\u3001\u96FE\u56E2\u6216\u5C18\u7D6E\u7FA4\u7684\u4E0B\u4E00\u6B21\u91CA\u653E5\u79D2\u3002\u8DDD\u79BB4\u683C\u4EE5\u5185\uFF1B\u4E0D\u4F5C\u7528\u4E8E\u5DF2\u91CA\u653E\u5371\u9669\u6216\u6301\u7EED\u5360\u6F06\u3002\u6CA1\u6709\u5408\u6CD5\u76EE\u6807\u4E0D\u6D88\u8017\u3002",
    summaryTool: "\u63A8\u8FDF\u5C1A\u672A\u91CA\u653E\u7684\u5371\u96695\u79D2\u3002",
    toolType: "active",
    toolUses: 4,
    toolRangePx: 128,
    toolDurationMs: 5e3,
    toolDetectionFillMult: 1,
    toolThrowDistancePx: 0,
    toolPulseIntervalMs: 0,
    narrativeOrigin: "\u7834\u53E3\u91CC\u6F0F\u51FA\u7684\u7802\u7C92\u8FDF\u8FDF\u4E0D\u843D\uFF0C\u6BCF\u4E00\u9897\u90FD\u60AC\u7740\u4E00\u5C0F\u6BB5\u672A\u5B8C\u7684\u65F6\u95F4\u3002"
  },
  "siphon": {
    active: true,
    toolResistanceBonus: 20,
    toolStopMs: 0,
    toolPlacementDistancePx: 0,
    toolMovementMult: 1,
    defenseRepairBonusHp: 6,
    defenseTransferCap: 0,
    defensePrimaryReduction: 0,
    defenseLowHpThreshold: 0,
    defenseLowHpReduction: 0,
    id: "siphon",
    rarity: "fine",
    displayNameDefense: "\u9644\u7740\u7684\u7A7A\u58F3",
    descriptionDefense: "\u51CF\u4F2415%\u3002\u5728\u4F9B\u5949\u4E2D\u5B9E\u9645\u627F\u53D7\u51B2\u51FB\u540E\uFF0C\u4E0B\u4E00\u6B21\u6709\u6548\u6CE8\u5165\u989D\u5916\u4FEE\u590D\u6700\u591A6\u70B9\u5B8C\u6574\u5EA6\u3002\u989D\u5EA6\u4E0D\u7D2F\u79EF\uFF0C\u53D6\u4E0B\u6216\u6210\u719F\u540E\u4ECD\u6709\u6548\u3002",
    summaryDefense: "\u51CF\u4F2415%\uFF0C\u627F\u538B\u540E\u52A9\u4FEE6\u70B9\u3002",
    defenseCategory: "\u6A21\u5757\u589E\u76CA",
    defenseReduction: 0.15,
    defenseSideEffect: "\u65E0",
    sideEffectDuration: "\u65E0",
    defenseChargeMult: 1,
    defenseSecondaryReduction: 0,
    defenseHealRatio: 0,
    displayNameTool: "\u9644\u7740\u7684\u7A7A\u58F3",
    descriptionTool: "\u88AB\u52A8\u3002\u771F\u5B9E\u53D7\u4F24\u540E\u589E\u52A020\u70B9\u6C61\u67D3\u6297\u6027\uFF0C\u6301\u7EED8\u79D2\uFF0C\u4E0E\u88C5\u5907\u6297\u6027\u53E0\u52A0\u81F3\u73B0\u6709\u4E0A\u9650\u3002\u751F\u6548\u671F\u95F4\u518D\u6B21\u53D7\u4F24\u4E0D\u91CD\u590D\u6D88\u8017\uFF0C\u4E0D\u56DE\u8840\uFF0C\u4E5F\u4E0D\u6D88\u9664\u5DF2\u7ECF\u79EF\u7D2F\u7684\u6DF7\u4E71\u3002",
    summaryTool: "\u53D7\u4F24\u540E\u6297\u6C61+20\uFF0C\u6301\u7EED8\u79D2\u3002",
    toolType: "passive",
    toolUses: 5,
    toolRangePx: 0,
    toolDurationMs: 8e3,
    toolDetectionFillMult: 1,
    toolThrowDistancePx: 0,
    toolPulseIntervalMs: 0,
    narrativeOrigin: "\u58F3\u7247\u5411\u5185\u62B1\u4F4F\u7A7A\u6D1E\uFF0C\u50CF\u8FD8\u5728\u4FDD\u62A4\u4E00\u5177\u65E9\u5DF2\u4E0D\u5728\u7684\u8EAB\u4F53\u3002"
  },
  "expand": {
    active: true,
    toolResistanceBonus: 0,
    toolStopMs: 0,
    toolPlacementDistancePx: 0,
    toolMovementMult: 1,
    defenseRepairBonusHp: 0,
    defenseTransferCap: 0,
    defensePrimaryReduction: 0,
    defenseLowHpThreshold: 0,
    defenseLowHpReduction: 0,
    id: "expand",
    rarity: "fine",
    displayNameDefense: "\u5E26\u7F3A\u53E3\u7684\u77F3\u5934",
    descriptionDefense: "\u7F3A\u53E3\u4EE440%\u51B2\u51FB\u5931\u53BB\u7740\u529B\u70B9\uFF0C\u7A33\u5B9A\u51CF\u4F2440%\uFF0C\u4E0D\u6263\u7A33\u5B9A\u5EA6\u3002",
    summaryDefense: "\u51CF\u4F2440%\u3002",
    defenseCategory: "\u4F24\u5BB3\u8F6C\u5316",
    defenseReduction: 0.4,
    defenseSideEffect: "\u65E0",
    sideEffectDuration: "\u65E0",
    defenseChargeMult: 1,
    defenseSecondaryReduction: 0,
    defenseHealRatio: 0,
    displayNameTool: "\u5E26\u7F3A\u53E3\u7684\u77F3\u5934",
    descriptionTool: "\u5411\u9762\u671D\u65B9\u5411\u8D8A\u8FC7\u4E00\u683C\u8584\u5899\uFF0C\u62B5\u8FBE\u5168\u8EAB\u53EF\u7AD9\u7ACB\u7684\u5B89\u5168\u4F4D\u7F6E\u540E\u5B9E\u4F53\u53161\u79D2\u3002\u4E0D\u80FD\u7A7F\u539A\u5899\u3001\u865A\u7A7A\u6216\u8FB9\u754C\uFF1B\u6CA1\u6709\u5408\u6CD5\u843D\u70B9\u4E0D\u6D88\u8017\u3002",
    summaryTool: "\u8D8A\u8FC7\u8584\u5899\uFF0C\u5B9E\u4F53\u53161\u79D2\u3002",
    toolType: "active",
    toolUses: 3,
    toolRangePx: 96,
    toolDurationMs: 1e3,
    toolDetectionFillMult: 1,
    toolThrowDistancePx: 0,
    toolPulseIntervalMs: 0,
    narrativeOrigin: "\u7F3A\u53E3\u7A7F\u8FC7\u77F3\u5FC3\uFF0C\u9694\u7740\u5B83\u770B\u53BB\uFF0C\u8FD1\u5904\u4E0E\u8FDC\u5904\u5076\u5C14\u91CD\u5408\u3002"
  },
  "resonate": {
    active: false,
    toolResistanceBonus: 0,
    toolStopMs: 0,
    toolPlacementDistancePx: 0,
    toolMovementMult: 1,
    defenseRepairBonusHp: 0,
    defenseTransferCap: 0,
    defensePrimaryReduction: 0,
    defenseLowHpThreshold: 0,
    defenseLowHpReduction: 0,
    id: "resonate",
    rarity: "rare",
    displayNameDefense: "\u5171\u632F\u6B8B\u6E23",
    descriptionDefense: "\u6765\u81EA\u8C10\u632F\u65F6\u7A7A\u7684\u9891\u7387\u788E\u7247\u3002\u51CF\u4F2430%\u4E14\u88C5\u5907\u671F\u95F4CORE\u548CSTORAGE\u6A21\u5757\u6548\u679C\u4E0A\u9650\u5404\u63D0\u534710%\u3002\u591A\u4E2A\u5171\u632F\u6B8B\u6E23\u4E0D\u53E0\u52A0\u6B64\u589E\u76CA\u3002",
    summaryDefense: "\u51CF\u4F24 30%\u3002\u6548\u679C\u4E0A\u9650 +10%\u3002",
    defenseCategory: "\u6A21\u5757\u589E\u76CA",
    defenseReduction: 0.3,
    defenseSideEffect: "30%\u6982\u7387\u5168slot\u540C\u6B65+1\u51B2\u51FB\u8BA1\u6570",
    sideEffectDuration: "\u5373\u65F6",
    defenseChargeMult: 1,
    defenseSecondaryReduction: 0,
    defenseHealRatio: 0,
    displayNameTool: "\u5171\u632F\u94FE\u63A5",
    descriptionTool: "\u9009\u62E9\u89C6\u91CE\u5185\u4E24\u4E2A\u70B9\u5728\u5B83\u4EEC\u4E4B\u95F4\u521B\u5EFA\u4E00\u6761\u80FD\u91CF\u5F26\u6301\u7EED10\u79D2\u3002\u4EFB\u4F55\u7A7F\u8D8A\u5F26\u7EBF\u7684\u654C\u4EBA\u88AB\u5F39\u56DE3\u683C\u5E76\u7729\u66552\u79D2\u3002\u7528\u4E8E\u5C01\u9501\u901A\u9053\u6216\u5728\u8EAB\u540E\u8BBE\u7F6E\u7ECA\u7EBF\u3002",
    summaryTool: "\u5F26\u7EBF\u7ECA\u654C 10 \u79D2\u3002\u5F39\u56DE\u7729\u6655\u3002",
    toolType: "active",
    toolUses: 2,
    toolRangePx: 0,
    toolDurationMs: 1e4,
    toolDetectionFillMult: 1,
    toolThrowDistancePx: 0,
    toolPulseIntervalMs: 0,
    narrativeOrigin: "\u8C10\u632F\u5171\u9E23\u65F6\u7A7A\u2014\u2014\u9891\u7387\u5171\u632F\u8986\u76D6\u4E00\u5207"
  },
  "overwrite": {
    active: false,
    toolResistanceBonus: 0,
    toolStopMs: 0,
    toolPlacementDistancePx: 0,
    toolMovementMult: 1,
    defenseRepairBonusHp: 0,
    defenseTransferCap: 0,
    defensePrimaryReduction: 0,
    defenseLowHpThreshold: 0,
    defenseLowHpReduction: 0,
    id: "overwrite",
    rarity: "rare",
    displayNameDefense: "\u8986\u5199\u6B8B\u6E23",
    descriptionDefense: "\u6765\u81EA\u89C4\u5219\u8986\u76D6\u65F6\u7A7A\u7684\u91CD\u5199\u788E\u7247\u3002\u51CF\u4F2440%\u4E14\u51B2\u51FB\u7ED3\u7B97\u540E\u964D\u4F4E\u4E0B\u4E00\u6B21\u6539\u9020\u5347\u7EA7\u8D39\u752830%(\u672A\u8D2D\u4E70\u5219\u6301\u7EED\u5230\u4E0B\u6B21\u51B2\u51FB\u5237\u65B0)\u3002",
    summaryDefense: "\u51CF\u4F24 40%\u3002\u4E0B\u6B21\u523B\u5165 -30%\u3002",
    defenseCategory: "\u7ECF\u6D4E\u6536\u76CA",
    defenseReduction: 0.4,
    defenseSideEffect: "25%\u6982\u7387\u6A21\u5757\u529F\u80FD\u4E92\u63621\u6B21\u51FA\u51FB",
    sideEffectDuration: "1\u6B21\u51FA\u51FB",
    defenseChargeMult: 1,
    defenseSecondaryReduction: 0,
    defenseHealRatio: 0,
    displayNameTool: "\u89C4\u5219\u8986\u5199",
    descriptionTool: "\u5BF9\u89C6\u91CE\u5185\u4E00\u4E2A\u654C\u4EBA\u65BD\u52A0\u884C\u4E3A\u8986\u519915\u79D2\u3002\u76EE\u6807\u7684\u5DE1\u903B\u8DEF\u7EBF\u53CD\u8F6C(\u671D\u8FDC\u79BB\u4F60\u7684\u65B9\u5411)\u4E14\u611F\u77E5\u8303\u56F4\u7F29\u5C0F50%\u3002\u82E5\u76EE\u6807\u6B63\u5728\u8FFD\u51FB\u5219\u7ACB\u523B\u964D\u7EA7\u4E3A\u8FD4\u56DE\u72B6\u6001\u3002",
    summaryTool: "\u8986\u5199\u654C\u4EBA 15 \u79D2\u3002\u5DE1\u903B\u53CD\u8F6C\u3002",
    toolType: "active",
    toolUses: 2,
    toolRangePx: 0,
    toolDurationMs: 15e3,
    toolDetectionFillMult: 1,
    toolThrowDistancePx: 0,
    toolPulseIntervalMs: 0,
    narrativeOrigin: "\u6A21\u5F0F\u8986\u76D6\u65F6\u7A7A\u2014\u2014\u6781\u5FEB\u901F\u5EA6\u91CD\u5199\u73B0\u5B9E\u89C4\u5219"
  },
  "erode": {
    active: false,
    toolResistanceBonus: 0,
    toolStopMs: 0,
    toolPlacementDistancePx: 0,
    toolMovementMult: 1,
    defenseRepairBonusHp: 0,
    defenseTransferCap: 0,
    defensePrimaryReduction: 0,
    defenseLowHpThreshold: 0,
    defenseLowHpReduction: 0,
    id: "erode",
    rarity: "rare",
    displayNameDefense: "\u4FB5\u8680\u6B8B\u6E23",
    descriptionDefense: "\u6765\u81EA\u541E\u566C\u6269\u5F20\u65F6\u7A7A\u7684\u53CD\u5411\u788E\u7247\u3002\u51CF\u4F2430%\u4E14\u6BCF\u6B21\u51B2\u51FB\u4F7F\u5176\u4ED6\u6240\u6709\u9632\u5FA1\u69FD\u91CC\u7684\u6B8B\u6E23\u989D\u5916+1\u51B2\u51FB\u8BA1\u6570\u52A0\u901F\u5B83\u4EEC\u8F6C\u5316\u4E3A\u5DE5\u5177\u3002\u5DE5\u5177\u4EA7\u51FA\u52A0\u901F\u5668\u3002",
    summaryDefense: "\u51CF\u4F24 30%\u3002\u5176\u5B83\u69FD\u5145\u80FD +1\u3002",
    defenseCategory: "\u52A0\u901F/\u50AC\u5316",
    defenseReduction: 0.3,
    defenseSideEffect: "20%\u6982\u7387\u4E0B\u6B21\u51FA\u51FB\u521D\u59CB\u6DF7\u4E71+8",
    sideEffectDuration: "1\u6B21\u51FA\u51FB",
    defenseChargeMult: 1,
    defenseSecondaryReduction: 0,
    defenseHealRatio: 0,
    displayNameTool: "\u4FB5\u8680\u9886\u57DF",
    descriptionTool: "\u5728\u811A\u4E0B\u91CA\u653E\u4E00\u7247\u4FB5\u8680\u573A(\u534A\u5F844\u683C)\u6301\u7EED12\u79D2\u3002\u9886\u57DF\u5185\u6240\u6709\u654C\u4EBA\u79FB\u901F-40%\u3001\u611F\u77E5\u8303\u56F4-30%\u3001\u8FFD\u51FB\u901F\u5EA6\u964D\u4E3A\u5DE1\u903B\u7EA7\u522B\u3002\u7528\u4E8E\u5B89\u5168\u4F5C\u4E1A\u6216\u524A\u5F31\u8FFD\u5175\u3002",
    summaryTool: "\u9886\u57DF 12 \u79D2\u3002\u654C\u79FB\u901F\u611F\u77E5\u964D\u3002",
    toolType: "active",
    toolUses: 2,
    toolRangePx: 128,
    toolDurationMs: 12e3,
    toolDetectionFillMult: 1,
    toolThrowDistancePx: 0,
    toolPulseIntervalMs: 0,
    narrativeOrigin: "\u4FB5\u8680\u6269\u5F20\u65F6\u7A7A\u2014\u2014\u4E3B\u52A8\u5411\u5916\u541E\u566C"
  },
  "muffle": {
    active: true,
    toolResistanceBonus: 0,
    toolStopMs: 0,
    toolPlacementDistancePx: 0,
    toolMovementMult: 1,
    defenseRepairBonusHp: 0,
    defenseTransferCap: 0,
    defensePrimaryReduction: 0,
    defenseLowHpThreshold: 0,
    defenseLowHpReduction: 0,
    id: "muffle",
    rarity: "common",
    displayNameDefense: "\u6D88\u58F0\u7684\u65E7\u5E03",
    descriptionDefense: "\u58F0\u54CD\u6D88\u5931\u5728\u6298\u5E03\u5185\uFF0C\u5438\u653630%\u51B2\u51FB\uFF0C\u4E0D\u6539\u53D8\u540E\u7EED\u51FA\u51FB\u3002",
    summaryDefense: "\u51CF\u4F2430%\u3002",
    defenseCategory: "\u7EAF\u51CF\u4F24",
    defenseReduction: 0.3,
    defenseSideEffect: "\u65E0",
    sideEffectDuration: "\u65E0",
    defenseChargeMult: 1,
    defenseSecondaryReduction: 0,
    defenseHealRatio: 0,
    displayNameTool: "\u6D88\u58F0\u7684\u65E7\u5E03",
    descriptionTool: "\u538B\u4F4F\u80FD\u591F\u5F15\u8D77\u654C\u4EBA\u542C\u89C9\u53D1\u73B0\u7684\u58F0\u97F3\uFF0C\u4E0D\u5C4F\u853D\u89C6\u89C9\u6216\u63A5\u89E6\u5371\u9669\u3002\u8FDE\u7EED\u542C\u89C9\u906D\u9047\u6D88\u80171\u6B21\uFF1B\u6700\u540E\u4E00\u4EFD\u6548\u679C\u5B8C\u6574\u7EF4\u6301\uFF0C\u8FDE\u7EED1.5\u79D2\u65E0\u6709\u6548\u542C\u89C9\u4FE1\u53F7\u540E\u7ED3\u675F\u3002",
    summaryTool: "\u538B\u4F4F\u542C\u89C9\uFF0C\u906D\u9047\u6263\u6B21\u3002",
    toolType: "passive",
    toolUses: 5,
    toolRangePx: 0,
    toolDurationMs: 1500,
    toolDetectionFillMult: 1,
    toolThrowDistancePx: 0,
    toolPulseIntervalMs: 0,
    narrativeOrigin: "\u5E03\u8936\u6DF1\u5904\u79EF\u7740\u7070\uFF0C\u63C9\u52A8\u65F6\u542C\u4E0D\u89C1\u7EA4\u7EF4\u6469\u64E6\u7684\u58F0\u97F3\u3002"
  },
  "kindle": {
    active: true,
    toolResistanceBonus: 0,
    toolStopMs: 0,
    toolPlacementDistancePx: 0,
    toolMovementMult: 1,
    defenseRepairBonusHp: 0,
    defenseTransferCap: 0,
    defensePrimaryReduction: 0,
    defenseLowHpThreshold: 0,
    defenseLowHpReduction: 0,
    id: "kindle",
    rarity: "common",
    displayNameDefense: "\u56DE\u58F0\u7A7A\u58F3",
    descriptionDefense: "\u51CF\u4F2420%\u3002\u58F3\u5185\u56DE\u58F0\u8BA9\u81EA\u8EAB\u6BCF\u8F6E\u4F9B\u5949\u79EF\u7D2F\u7FFB\u500D\uFF0C\u4E0D\u52A0\u4E0B\u6B21\u51FA\u51FB\u6DF7\u4E71\u3002",
    summaryDefense: "\u51CF\u4F2420%\uFF0C\u79EF\u7D2F\u7FFB\u500D\u3002",
    defenseCategory: "\u52A0\u901F/\u50AC\u5316",
    defenseReduction: 0.2,
    defenseSideEffect: "\u65E0",
    sideEffectDuration: "\u65E0",
    defenseChargeMult: 2,
    defenseSecondaryReduction: 0,
    defenseHealRatio: 0,
    displayNameTool: "\u56DE\u58F0\u7A7A\u58F3",
    descriptionTool: "\u5411\u9762\u671D\u65B9\u5411\u7684\u5408\u6CD5\u4F4D\u7F6E\u629B\u51FA\u56DE\u58F0\u7A7A\u58F3\uFF0C\u6301\u7EED6\u79D2\u53D1\u51FA\u58F0\u97F3\uFF0C\u6700\u8FDC\u53EF\u4F2096\u50CF\u7D20\uFF1B\u654C\u4EBA\u7684\u542C\u529B\u4E0E\u7A7A\u95F4\u906E\u6321\u4F1A\u7F29\u77ED\u53EF\u542C\u8303\u56F4\u3002\u9002\u5408\u5F15\u5F00\u5C1A\u672A\u9501\u5B9A\u4F60\u7684\u654C\u4EBA\uFF1B\u4E0D\u4F1A\u8BA9\u5DF2\u786E\u8BA4\u8FFD\u9010\u8005\u5FD8\u8BB0\u4F60\u3002\u4E0D\u4F1A\u9020\u6210\u4F24\u5BB3\uFF0C\u4E5F\u53EF\u80FD\u5F15\u6765\u5176\u4ED6\u5A01\u80C1\u3002",
    summaryTool: "\u629B\u51FA\u58F0\u97F3\u8BF1\u99756\u79D2\uFF1B\u4E0D\u89E3\u9664\u5DF2\u786E\u8BA4\u7684\u8FFD\u9010\u3002",
    toolType: "active",
    toolUses: 5,
    toolRangePx: 96,
    toolDurationMs: 6e3,
    toolDetectionFillMult: 1,
    toolThrowDistancePx: 96,
    toolPulseIntervalMs: 1e3,
    narrativeOrigin: "\u58F3\u53E3\u91CC\u6CA1\u6709\u6D3B\u7269\uFF0C\u5374\u4F1A\u91CD\u590D\u5B83\u66FE\u7ECF\u6536\u8FDB\u53BB\u7684\u58F0\u54CD\u3002"
  },
  "stitch": {
    active: true,
    toolResistanceBonus: 0,
    toolStopMs: 1500,
    toolPlacementDistancePx: 32,
    toolMovementMult: 1,
    defenseRepairBonusHp: 0,
    defenseTransferCap: 4,
    defensePrimaryReduction: 0,
    defenseLowHpThreshold: 0,
    defenseLowHpReduction: 0,
    id: "stitch",
    rarity: "common",
    displayNameDefense: "\u6253\u7ED3\u7684\u7EC6\u7EBF",
    descriptionDefense: "\u51CF\u4F2420%\uFF0C\u518D\u5C06\u4E3B\u8981\u53D7\u51B2\u51FB\u6A21\u5757\u6700\u591A4\u70B9\u4F24\u5BB3\u8F6C\u7ED9\u4F59\u8840\u6700\u591A\u7684\u53E6\u4E00\u6A21\u5757\u3002\u63A5\u6536\u65B9\u81F3\u5C11\u4FDD\u75591\u70B9\u5B8C\u6574\u5EA6\uFF0C\u6CA1\u6709\u5B89\u5168\u63A5\u6536\u8005\u65F6\u4E0D\u8F6C\u79FB\u3002",
    summaryDefense: "\u51CF\u4F2420%\uFF0C\u8F6C\u79FB\u81F3\u591A4\u70B9\u3002",
    defenseCategory: "\u4F24\u5BB3\u5206\u62C5",
    defenseReduction: 0.2,
    defenseSideEffect: "\u65E0",
    sideEffectDuration: "\u65E0",
    defenseChargeMult: 1,
    defenseSecondaryReduction: 0,
    defenseHealRatio: 0,
    displayNameTool: "\u6253\u7ED3\u7684\u7EC6\u7EBF",
    descriptionTool: "\u5728\u9762\u524D1\u683C\u5904\u6A2A\u94FA2\u683C\u957F\u7684\u6253\u7ED3\u7684\u7EC6\u7EBF\uFF0C\u6301\u7EED10\u79D2\u3002\u6BCF\u4E2A\u5730\u9762\u5B9E\u4F53\u9996\u6B21\u8DE8\u7EBF\u65F6\u6B62\u6B651.5\u79D2\uFF0C\u4ECD\u53EF\u611F\u77E5\u548C\u653B\u51FB\u3002\u4E0D\u8DE8\u5899\u6216\u865A\u7A7A\uFF0C\u65E0\u6CD5\u94FA\u6210\u5B8C\u6574\u7EBF\u6BB5\u65F6\u4E0D\u6D88\u8017\u3002",
    summaryTool: "\u6A2A\u94FA\u77ED\u7EBF\uFF0C\u8DE8\u7EBF\u6B62\u6B65\u3002",
    toolType: "active",
    toolUses: 4,
    toolRangePx: 64,
    toolDurationMs: 1e4,
    toolDetectionFillMult: 1,
    toolThrowDistancePx: 0,
    toolPulseIntervalMs: 0,
    narrativeOrigin: "\u65E7\u7EBF\u7ED3\u7684\u4E24\u7AEF\u63A5\u4E0D\u5230\u540C\u4E00\u5904\uFF0C\u62C9\u7D27\u65F6\u5374\u4F1A\u8BA9\u9644\u8FD1\u7684\u5730\u9762\u7EF7\u4F4F\u3002"
  },
  "compress": {
    active: true,
    toolResistanceBonus: 0,
    toolStopMs: 0,
    toolPlacementDistancePx: 0,
    toolMovementMult: 0.5,
    defenseRepairBonusHp: 0,
    defenseTransferCap: 0,
    defensePrimaryReduction: 0.5,
    defenseLowHpThreshold: 0,
    defenseLowHpReduction: 0,
    id: "compress",
    rarity: "fine",
    displayNameDefense: "\u6C89\u91CD\u7684\u77F3\u5757",
    descriptionDefense: "\u627F\u4F4F\u51B2\u51FB\u6700\u96C6\u4E2D\u7684\u4E00\u80A1\uFF0C\u4F7F\u4E3B\u8981\u6A21\u5757\u53D7\u5230\u7684\u4F24\u5BB3\u51CF\u5C1150%\u3002\u4E0D\u51CF\u8F7B\u5176\u4ED6\u6A21\u5757\u7684\u4F59\u6CE2\u3002",
    summaryDefense: "\u4E3B\u8981\u6A21\u5757\u51CF\u4F2450%\u3002",
    defenseCategory: "\u5B9A\u70B9\u4FDD\u62A4",
    defenseReduction: 0,
    defenseSideEffect: "\u65E0",
    sideEffectDuration: "\u65E0",
    defenseChargeMult: 1,
    defenseSecondaryReduction: 0,
    defenseHealRatio: 0,
    displayNameTool: "\u6C89\u91CD\u7684\u77F3\u5757",
    descriptionTool: "\u5728\u811A\u4E0B\u7559\u4E0B\u534A\u5F842\u683C\u7684\u6C89\u91CD\u533A\u57DF\uFF0C\u6301\u7EED6\u79D2\u3002\u533A\u57DF\u5185\u5730\u9762\u5B9E\u4F53\u79FB\u901F\u964D\u4F4E50%\uFF0C\u79BB\u5F00\u5373\u6062\u590D\uFF1B\u4E0D\u6539\u53D8\u65B9\u5411\u3001\u611F\u77E5\u6216\u653B\u51FB\uFF0C\u573A\u57DF\u672C\u8EAB\u4E0D\u53D7\u5F71\u54CD\u3002",
    summaryTool: "\u811A\u4E0B\u91CD\u533A\uFF0C\u654C\u79FB\u901F\u51CF\u534A\u3002",
    toolType: "active",
    toolUses: 4,
    toolRangePx: 64,
    toolDurationMs: 6e3,
    toolDetectionFillMult: 1,
    toolThrowDistancePx: 0,
    toolPulseIntervalMs: 0,
    narrativeOrigin: "\u65AD\u9762\u671D\u4E0B\u5760\u7740\uFF0C\u653E\u5230\u5730\u4E0A\u4EE5\u540E\uFF0C\u9644\u8FD1\u7684\u811A\u6B65\u4E5F\u50CF\u88AB\u5B83\u6525\u4F4F\u3002"
  },
  "mirror": {
    active: true,
    toolResistanceBonus: 0,
    toolStopMs: 0,
    toolPlacementDistancePx: 0,
    toolMovementMult: 1,
    defenseRepairBonusHp: 0,
    defenseTransferCap: 0,
    defensePrimaryReduction: 0,
    defenseLowHpThreshold: 0,
    defenseLowHpReduction: 0,
    id: "mirror",
    rarity: "fine",
    displayNameDefense: "\u7559\u5F71\u73BB\u7483",
    descriptionDefense: "\u51CF\u4F2425%\uFF0C\u975E\u4E3B\u8981\u76EE\u6807\u627F\u53D7\u7684\u4F59\u6CE2\u518D\u51CF\u5C1125%\u3002\u4E0D\u8FD4\u8FD8\u85AA\u67F4\u6216\u8BEF\u5BFC\u9884\u544A\u3002",
    summaryDefense: "\u51CF\u4F2425%\uFF0C\u524A\u5F31\u4F59\u6CE2\u3002",
    defenseCategory: "\u7ECF\u6D4E\u6536\u76CA",
    defenseReduction: 0.25,
    defenseSideEffect: "\u65E0",
    sideEffectDuration: "\u65E0",
    defenseChargeMult: 1,
    defenseSecondaryReduction: 0.25,
    defenseHealRatio: 0,
    displayNameTool: "\u7559\u5F71\u73BB\u7483",
    descriptionTool: "\u5728\u539F\u5730\u7559\u4E0B\u4E00\u5177\u6301\u7EED8\u79D2\u7684\u89C6\u89C9\u8BF1\u9975\u3002\u53EA\u6709\u80FD\u5B9E\u9645\u770B\u89C1\u5B83\u7684\u654C\u4EBA\u624D\u53EF\u80FD\u88AB\u5438\u5F15\uFF1B\u4E0D\u4F1A\u62B9\u53BB\u654C\u4EBA\u5DF2\u7ECF\u786E\u8BA4\u7684\u76EE\u6807\u3002",
    summaryTool: "\u7559\u4E0B\u89C6\u89C9\u8BF1\u99758\u79D2\u3002",
    toolType: "active",
    toolUses: 4,
    toolRangePx: 0,
    toolDurationMs: 8e3,
    toolDetectionFillMult: 1,
    toolThrowDistancePx: 0,
    toolPulseIntervalMs: 0,
    narrativeOrigin: "\u65E7\u73BB\u7483\u7559\u4E0B\u7684\u4E0D\u662F\u9762\u5BB9\uFF0C\u800C\u662F\u521A\u521A\u7AD9\u8FC7\u7684\u4F4D\u7F6E\u3002"
  },
  "echo": {
    active: false,
    toolResistanceBonus: 0,
    toolStopMs: 0,
    toolPlacementDistancePx: 0,
    toolMovementMult: 1,
    defenseRepairBonusHp: 0,
    defenseTransferCap: 0,
    defensePrimaryReduction: 0,
    defenseLowHpThreshold: 0,
    defenseLowHpReduction: 0,
    id: "echo",
    rarity: "fine",
    displayNameDefense: "\u56DE\u54CD\u6B8B\u6E23",
    descriptionDefense: "\u6765\u81EA\u56DE\u54CD\u65F6\u7A7A\u7684\u9707\u8361\u788E\u7247\u3002\u51CF\u4F24\u4EC520%\u2014\u2014\u4F46\u6BCF\u6B21\u51B2\u51FB\u7ED3\u7B97\u540E\u968F\u673A\u9009\u62E9\u5DE5\u5177\u5E93\u4E2D\u4E00\u4EF6\u5DF2\u6709\u5DE5\u5177\u4F7F\u5176\u4F7F\u7528\u6B21\u6570+1(\u5355\u4EF6\u56E0\u6B64\u6700\u591A+2)\u3002\u9632\u5FA1\u4F4D\u6295\u8D44\u8F6C\u5316\u4E3A\u51FA\u51FB\u5DE5\u5177\u7EED\u822A\u3002",
    summaryDefense: "\u51CF\u4F24 20%\u3002\u968F\u673A\u5DE5\u5177\u4F59\u91CF\u589E\u3002",
    defenseCategory: "\u52A0\u901F/\u50AC\u5316",
    defenseReduction: 0.2,
    defenseSideEffect: "20%\u6982\u7387\u4E0B\u6B21\u51FA\u51FB\u521D\u59CB\u6DF7\u4E71+6",
    sideEffectDuration: "1\u6B21\u51FA\u51FB",
    defenseChargeMult: 1,
    defenseSecondaryReduction: 0,
    defenseHealRatio: 0,
    displayNameTool: "\u56DE\u54CD\u8109\u51B2",
    descriptionTool: "\u91CA\u653E\u4E00\u5708\u65E0\u5F62\u58F0\u6CE2\u8109\u51B2(\u534A\u5F843\u683C)\u3002\u8303\u56F4\u5185\u6240\u6709\u654C\u4EBA\u5DE1\u903B\u65B9\u5411\u7ACB\u523B\u53CD\u8F6C\u4E14\u8FDB\u51653\u79D2\u539F\u5730\u505C\u6EDE\u65E0\u6CD5\u884C\u52A8\u3002\u7528\u4E8E\u591A\u654C\u9760\u8FD1\u65F6\u5236\u9020\u65B9\u5411\u6DF7\u4E71\u3002",
    summaryTool: "\u8109\u51B2\u4F7F\u654C\u8F6C\u5411\u5E76\u505C\u6EDE 3 \u79D2\u3002",
    toolType: "active",
    toolUses: 3,
    toolRangePx: 96,
    toolDurationMs: 3e3,
    toolDetectionFillMult: 1,
    toolThrowDistancePx: 0,
    toolPulseIntervalMs: 0,
    narrativeOrigin: "\u56DE\u54CD\u9707\u8361\u65F6\u7A7A\u2014\u2014\u4E00\u5207\u52A8\u4F5C\u5728\u6B64\u65E0\u9650\u91CD\u590D\u56DE\u8361\u4E0D\u6B62"
  },
  "abyss": {
    active: true,
    toolResistanceBonus: 0,
    toolStopMs: 0,
    toolPlacementDistancePx: 0,
    toolMovementMult: 1,
    defenseRepairBonusHp: 0,
    defenseTransferCap: 0,
    defensePrimaryReduction: 0,
    defenseLowHpThreshold: 0.4,
    defenseLowHpReduction: 0.5,
    id: "abyss",
    rarity: "rare",
    displayNameDefense: "\u6620\u51FA\u522B\u5904\u7684\u73E0\u5B50",
    descriptionDefense: "\u5404\u6A21\u5757\u51CF\u4F2420%\uFF1B\u51B2\u51FB\u524D\u5B8C\u6574\u5EA6\u4E0D\u9AD8\u4E8E40%\u7684\u6A21\u5757\u6539\u4E3A\u51CF\u4F2450%\u3002\u4E0D\u4F24\u5BB3\u5176\u4ED6\u6A21\u5757\u3002",
    summaryDefense: "\u51CF\u4F2420%\uFF0C\u6FD2\u5371\u65F650%\u3002",
    defenseCategory: "\u5371\u6025\u4FDD\u62A4",
    defenseReduction: 0.2,
    defenseSideEffect: "\u65E0",
    sideEffectDuration: "\u65E0",
    defenseChargeMult: 1,
    defenseSecondaryReduction: 0,
    defenseHealRatio: 0,
    displayNameTool: "\u6620\u51FA\u522B\u5904\u7684\u73E0\u5B50",
    descriptionTool: "\u57286\u683C\u4EE5\u5185\u6CBF\u53EF\u901A\u884C\u7A7A\u95F4\u56DE\u63A2\uFF0C\u77ED\u6682\u6807\u8BB0\u5B9E\u4F53\u3001\u73AF\u5883\u5371\u9669\u6838\u5FC3\u53CA\u672A\u7FFB\u627E\u5806\u7684\u4F4D\u7F6E\uFF0C\u4FDD\u75596\u79D2\u3002\u53EA\u8BB0\u5F55\u65BD\u653E\u77AC\u95F4\uFF0C\u4E0D\u663E\u793A\u5185\u5BB9\u7269\u6216\u5B9E\u65F6\u8FFD\u8E2A\uFF0C\u4E0D\u8D8A\u8FC7\u5C01\u95ED\u5899\u4F53\u63A2\u77E5\u53E6\u4E00\u4FA7\u3002",
    summaryTool: "\u8FD1\u5904\u4F4D\u7F6E\u5FEB\u7167\uFF0C\u4FDD\u75596\u79D2\u3002",
    toolType: "active",
    toolUses: 3,
    toolRangePx: 192,
    toolDurationMs: 6e3,
    toolDetectionFillMult: 1,
    toolThrowDistancePx: 0,
    toolPulseIntervalMs: 0,
    narrativeOrigin: "\u73E0\u5B50\u80CC\u9762\u7684\u9ED1\u59CB\u7EC8\u671D\u5411\u4F60\uFF0C\u85CF\u5728\u9ED1\u91CC\u7684\u5FAE\u5149\u5374\u6620\u7740\u522B\u5904\u3002"
  },
  "combust": {
    active: true,
    toolResistanceBonus: 0,
    toolStopMs: 0,
    toolPlacementDistancePx: 0,
    toolMovementMult: 1,
    defenseRepairBonusHp: 0,
    defenseTransferCap: 0,
    defensePrimaryReduction: 0,
    defenseLowHpThreshold: 0,
    defenseLowHpReduction: 0,
    id: "combust",
    rarity: "rare",
    displayNameDefense: "\u51B7\u5374\u7684\u4F59\u70EC",
    descriptionDefense: "\u51CF\u4F2425%\u3002\u6BCF\u8F6E\u5C06\u672C\u6B21\u5B9E\u9645\u627F\u4F24\u768420%\u7528\u4E8E\u4FEE\u590D\u6700\u4F4E\u5B8C\u6574\u5EA6\u6A21\u5757\uFF1B\u6CA1\u6709\u627F\u4F24\u4E0D\u4EA7\u751F\u4FEE\u590D\uFF0C\u4E0D\u589E\u52A0\u4E0B\u6B21\u51FA\u51FB\u6DF7\u4E71\u3002",
    summaryDefense: "\u51CF\u4F2425%\uFF0C\u627F\u4F24\u8F6C\u4FEE\u590D\u3002",
    defenseCategory: "\u4F24\u5BB3\u8F6C\u5316",
    defenseReduction: 0.25,
    defenseSideEffect: "\u65E0",
    sideEffectDuration: "\u65E0",
    defenseChargeMult: 1,
    defenseSecondaryReduction: 0,
    defenseHealRatio: 0.2,
    displayNameTool: "\u51B7\u5374\u7684\u4F59\u70EC",
    descriptionTool: "\u538B\u4F4F4\u683C\u5185\u53EF\u89C1\u4E14\u65E0\u906E\u6321\u7684\u6700\u8FD1\u6D3B\u52A8\u6C61\u67D3\u6E905\u79D2\u3002\u6C14\u56E2\u3001\u96FE\u56E2\u3001\u5C18\u7D6E\u7FA4\u7684\u5404\u6D3B\u52A8\u9636\u6BB5\u53CA\u6301\u7EED\u5360\u6F06\u5747\u53EF\u4F5C\u7528\uFF1B\u5DF2\u53D7\u538B\u5236\u6216\u6682\u7F13\u7684\u76EE\u6807\u4E0D\u80FD\u91CD\u590D\u4F7F\u7528\u3002\u5B9E\u4F53\u4ECD\u53EF\u653B\u51FB\uFF1B\u6CA1\u6709\u5408\u6CD5\u76EE\u6807\u4E0D\u6D88\u8017\u3002",
    summaryTool: "\u538B\u4F4F\u6D3B\u52A8\u6C61\u67D3\u6E905\u79D2\u3002",
    toolType: "active",
    toolUses: 3,
    toolRangePx: 128,
    toolDurationMs: 5e3,
    toolDetectionFillMult: 1,
    toolThrowDistancePx: 0,
    toolPulseIntervalMs: 0,
    narrativeOrigin: "\u4F59\u70EC\u65E9\u5DF2\u51B7\u900F\uFF0C\u6697\u7F1D\u4ECD\u7F13\u6162\u541E\u4E0B\u5468\u56F4\u8E81\u52A8\u7684\u5FAE\u5149\u3002"
  }
};
var ACTIVE_CONTAMINANT_TYPES = ["solidify", "scatter", "retrograde", "delay", "siphon", "expand", "muffle", "kindle", "stitch", "compress", "mirror", "abyss", "combust"];
var ACTIVE_CONTAMINANT_DATA = ACTIVE_CONTAMINANT_TYPES.map((id) => CONTAMINANT_DATA[id]);

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/config/constants.ts
var GAME_CONSTANTS = {
  /** Tile size in pixels */
  TILE_SIZE: 32,
  /** Camera. Zoom 1.5 on a 960x640 canvas gives a ~640x427 logical viewport = ~20x13 tiles (DEC-009). */
  CAMERA: {
    ZOOM: 1.5
  },
  /** Player movement (docs/specs/system-movement-vision.md, section M) */
  PLAYER: {
    SPEED: 80,
    // px/s base speed = 2.5 tiles/s (tuned down for deliberate stealth feel)
    MAX_HEALTH: 100,
    INVENTORY_SLOTS: 4,
    MOVE_ACCEL_TIME: 0.08,
    // s from standstill to full speed
    MOVE_DECEL_TIME: 0.1,
    // s from full speed to standstill
    FACING_TURN_RATE: 1080,
    // deg/s the vision cone swings toward the input direction
    FACING_QUANT_HYSTERESIS: 5,
    // deg of dead zone around the 45 degree facing4 boundaries
    BODY_SIZE: 20,
    // px collider edge; < TILE_SIZE so 1-tile gaps stay passable
    BODY_OFFSET: { x: 6, y: 6 },
    // centres the collider inside the 32x32 sprite
    SPEED_MOD_MIN: 0.5
    // floor on the multiplied speed modifier stack
  },
  /**
   * Presentation-only gait (art-direction §3.3). Does not change facingAngle,
   * facing4 snap timing, speeds, or colliders.
   */
  ACTOR_MOTION: {
    FRAME_COUNT: 4,
    TURN_MS: 180,
    LAG_PX: 3,
    LAG_ALPHA: 0.38,
    MOVE_SPEED_FLOOR: 6,
    // px/s; below this the idle cycle plays
    PLAYER_IDLE_FPS: 4,
    PLAYER_WALK_FPS: 8,
    INFILTRATOR_IDLE_FPS: 4,
    INFILTRATOR_WALK_FPS: 4,
    // puppet hitch supplies the step; keep the sheet slow
    REWRITER_IDLE_FPS: 4,
    REWRITER_WALK_FPS: 6
  },
  /** Chaos system (docs/specs/system-chaos-scavenge-extract.md) */
  CHAOS: {
    START_VALUE: 0,
    MAX_VALUE: 100,
    // HUD gauge max (value CAN exceed this)
    HARD_CAP: 150,
    BASE_RATE: 0.5,
    // points per second (DEC-024: calibrated for 80 px/s travel)
    THRESHOLD_1: 50,
    THRESHOLD_2: 75,
    THRESHOLD_3: 100,
    COMBAT_BONUS: 5,
    DETECTION_BONUS: 3,
    DETECTION_BONUS_COOLDOWN: 1e4,
    // ms per-enemy cooldown on detection chaos
    CHASE_RATE_MULT: 2,
    EMIT_STEP: 1,
    // minimum delta before emitting CHAOS_CHANGED
    MODULATOR_STEP: 1
    // minimum delta before calling onModulate callback
  },
  /** Loot / kindling nodes (docs/specs/system-chaos-scavenge-extract.md) */
  LOOT: {
    /** 迭代 10 起退役，见 spec 规则 14。名义参数，代码无引用；由 SEARCH_RADIUS 取代。 */
    PICKUP_RADIUS: 16,
    NODE_COUNT: 8,
    VALUE_SAFE: 1,
    VALUE_CONTESTED: 2,
    VALUE_DEEP: 4,
    SEARCH_CHANNEL_MS: 1200,
    SEARCH_RADIUS: 48,
    SEARCH_NOISE_RADIUS: 96,
    SEARCH_NOISE_LEVEL: "suspicious"
  },
  /** Extraction point (docs/specs/system-chaos-scavenge-extract.md) */
  EXTRACTION: {
    TRIGGER_RADIUS: 48,
    KEY: "E",
    SETTLE_DELAY_MS: 600,
    RESTART_KEY: "R"
  },
  /**
   * Visibility / FOV (docs/specs/system-movement-vision.md, section V).
   * Models a forward cone unioned with an ambient ring, with three fixed-width edge
   * bands. The older single-radius + edge-softness model was replaced rather than
   * extended, so the two parameter sets never coexist.
   */
  VISIBILITY: {
    RADIUS_FORWARD: 224,
    // px straight ahead (7 tiles); must exceed every profile sightRange (I1)
    RADIUS_AMBIENT: 80,
    // px all around (2.5 tiles) = the lamp the player carries
    CONE_HALF_ANGLE: 50,
    // deg half-angle of the full-range sector
    CONE_FALLOFF_ANGLE: 30,
    // deg of transition from forward range down to ambient
    MIN_SOLID_RADIUS: 48,
    // px that stay fully lit no matter what
    EDGE_BAND_WIDTH: 32,
    // px per gradient band (1 tile, art-direction 4.3)
    BAND_ALPHAS: [1, 0.6, 0.2],
    // visibility of core / middle / outer band
    ERASE_ALPHAS: [1, 0.5, 0.2],
    // per-layer erase strength producing those alphas
    RAY_COUNT: 60,
    // architecture ceiling
    RAY_SPLIT_FORWARD: 40,
    // rays inside the cone sector
    RAY_SPLIT_AMBIENT: 20,
    // rays across the remaining angles
    RAY_COUNT_DEGRADED: 40,
    // first degradation step
    RAY_SPLIT_FORWARD_DEGRADED: 28,
    RAY_SPLIT_AMBIENT_DEGRADED: 12,
    MIN_RADIUS_SCALE: 0.4,
    // hard floor for the chaos radius modulator
    CACHE_POS_EPSILON: 0.5,
    // px of movement tolerated before the cache is dropped
    CACHE_ANGLE_EPSILON: 0.5,
    // deg of rotation tolerated before the cache is dropped
    BUDGET_MS: 2,
    // per-frame raycasting budget
    DEGRADE_SAMPLE_FRAMES: 30,
    // consecutive frames over budget before degrading
    /** Void outside the field of view */
    VOID_COLOR: 526860,
    VOID_NOISE_ALPHA: 0.04,
    VOID_NOISE_TILE: 64,
    // px noise texture size
    VOID_NOISE_SCROLL: 2,
    // px/s drift
    /** Warm lamp the player carries - the only warm light inside a rift */
    PLAYER_LAMP_COLOR: 9067562,
    PLAYER_LAMP_ALPHA: 0.12,
    /**
     * Flashlight beam: an additive warm pool pushed forward along facing and clipped to
     * the vision cone by the darkness mask. This is what makes the forward cone read as
     * "lit by a flashlight" rather than merely "revealed" (A-G3 / DEC-018 beam gain).
     */
    FLASHLIGHT_COLOR: 11047018,
    // pale warm; a saturated brown would wash the cold floor out
    FLASHLIGHT_ALPHA: 0.16,
    // low enough that fragment L1 (clinic/metro/soil) still reads under the cone
    FLASHLIGHT_FORWARD_FRAC: 0.34,
    // push the pool centre this fraction of forward range ahead
    FLASHLIGHT_RADIUS_FRAC: 0.85,
    // pool radius as a fraction of forward range
    /** Glow bleeding through the darkness (Slice 1: extraction point only) */
    GLOW_LEAK_ALPHA: 0.25,
    GLOW_LEAK_RADIUS: 48,
    /** Chaos corruption of the vision edge */
    CORRUPTION_COLOR: 1748374,
    CORRUPTION_MAX_MIX: 0.6,
    // alpha of the teal band at corruption 1.0
    CORRUPTION_MAX_DEPTH: 0.35,
    // fraction of the range teal can eat at corruption 1.0
    CORRUPTION_JITTER_PX: 4,
    CORRUPTION_JITTER_HZ: 6,
    /**
     * Overflow (chaos > 100) full-screen teal wash. Persistent base stays well below the
     * old 0.08 epilepsy cap; the jump is a discrete ~2 s pulse (not a strobe), so its
     * peak can read as a "skip" without a rapid flash train.
     */
    FLICKER_BASE_ALPHA: 0.05,
    FLICKER_JUMP_ALPHA: 0.16,
    FLICKER_JUMP_PERIOD_MS: 2200,
    FLICKER_JUMP_WIDTH_MS: 140,
    /** Extra teal bite / edge jitter scale at screenFlicker = 1.0 */
    OVERFLOW_CORRUPTION_DEPTH_BOOST: 0.4,
    OVERFLOW_JITTER_BOOST: 1,
    /** Purification point overrides (omni mode) */
    PURIFY_RADIUS: 400,
    PURIFY_RAY_COUNT: 90
  },
  /**
   * Enemy AI (docs/specs/system-enemy-ai.md, "数值结构"). Every AI number lives here;
   * none are inlined in the systems.
   *
   * Six of these values are load-bearing relations rather than free parameters - the
   * balance invariants I1-I6 that make stealth playable at all. `config/invariants.ts`
   * asserts them at boot so tuning cannot silently break one.
   *
   * The old `SIGHT_ANGLE: 90 // cone half-angle` key was removed rather than kept: its
   * meaning split into a core cone and a peripheral band, and three overlapping angle
   * parameters would have been three ways to be wrong.
   */
  AI: {
    // --- movement and body (shared; per-role speeds live in data/enemies.csv) ---
    TURN_RATE: 360,
    // deg/s; a third of the player's, which is what makes flanking work (I6)
    BODY_SIZE: 20,
    // px collider edge; < TILE_SIZE so 1-tile gaps stay passable
    BODY_OFFSET: { x: 6, y: 6 },
    // centres the collider inside the 32x32 infiltrator sprite
    SEPARATION_RADIUS: 24,
    // px; soft repulsion instead of enemy-vs-enemy physics
    SEPARATION_WEIGHT: 0.35,
    // how strongly separation bends the movement direction
    STANDOFF_DISTANCE: 30,
    // px; where a chaser stops. Must stay under COMBAT.ATTACK_RANGE
    STANDOFF_BAND: 4,
    // px of tolerance around it (26..34)
    STANDOFF_ADJUST_SPEED: 60,
    // px/s used to back off when the player crowds it
    // --- perception (shared; cone / hearing radii / weights live in data/enemies.csv) ---
    DETECT_FILL_TIME: 0.45,
    // s of clear sight to go from 0 to certain; then × visionWeight
    HEAR_FILL_TIME: 2,
    // s of hearing fill baseline; then × hearingWeight × moveMult
    HEARING_STILL_CAP: 0.2,
    // still-hearing cannot push detection past this (below 0.35)
    HEAR_ALERT_THRESHOLD: 0.7,
    // rewriter T0-4b: hearing can push to ALERT, never CHASE
    DETECT_DIST_FACTOR_NEAR: 1.6,
    // detection rate multiplier at point blank
    DETECT_DIST_FACTOR_FAR: 0.5,
    // ...and at the edge of sight range
    DETECT_ZONE_FACTOR_PERIPH: 0.45,
    // peripheral vision fills far slower than the core cone
    SUSPICION_THRESHOLD: 0.35,
    // detection at which it stops and turns - the player's warning
    REACQUIRE_THRESHOLD: 0.5,
    // lower bar to re-lock while already searching
    DETECT_DECAY_RATE: 0.67,
    // per s; ~1.5 s to clear after breaking sight
    DETECT_DECAY_ALERT_SCALE: 0.5,
    // decays half as fast while searching: it is holding a grudge
    HEARING_JITTER: 32,
    // px of positional fuzz, so hearing is not a wall-hack locator
    PERCEPTION_TICK_MS: 100,
    // 10 Hz perception; one raycast per enemy per tick
    PERCEPTION_TICK_MS_FAR: 200,
    // 5 Hz beyond ACTIVE_RANGE (rule N8)
    // --- timers (section "计时器") ---
    LOS_GRACE_MS: 400,
    // how long a chase survives with no line of sight
    LOST_PLAYER_DURATION: 5e3,
    // ms of ALERT searching
    ALERT_DURATION: 3e3,
    // ms a SUSPICIOUS enemy stays wary with no new stimulus
    CHASE_ABANDON_RANGE: 320,
    // px past which an unseen chase is given up
    WAYPOINT_PAUSE_MS: 1200,
    // dwell at a patrol waypoint - the player's window to slip past
    SCAN_HOLD_MS: 600,
    // dwell on each scan heading
    SEARCH_HOLD_MS: 800,
    // dwell at each ALERT search point
    EXTRAPOLATE_SEC: 0.6,
    // how far ahead of the last sighting to guess - punishes running straight
    SEARCH_SPREAD: 96,
    // px radius of the random third search point
    ALERT_EMIT_COOLDOWN_MS: 1e3,
    // suppression window for repeated same-level ENEMY_ALERT
    SUSPICIOUS_TURN_HOLD_MS: 200,
    // minimum standstill when turning to look (rule B2, ">= 0.2 s")
    SCAN_SWEEP_ANGLE: 45,
    // deg to each side when scanning in place
    SCAN_SWEEP_PERIOD_MS: 1500,
    // full left-right-left sweep period
    FACING_ARRIVE_EPSILON: 6,
    // deg within which a turn counts as completed
    // --- pathfinding and performance (section "寻路与性能") ---
    MAX_PATHS_PER_FRAME: 1,
    // architecture hard rule
    REPATH_INTERVAL_MS: 500,
    REPATH_INTERVAL_MS_FAR: 1e3,
    // for requests past SIMPLE_PATH_RANGE (rule N5)
    REPATH_MOVE_THRESHOLD: 48,
    // px of target movement that earns an early chase repath
    SIMPLE_PATH_RANGE: 384,
    // px past which a request drops to the lowest priority
    ASTAR_MAX_NODES: 3e3,
    // expansion ceiling; real cap is the 5ms budget, not node count. Worst cross-map search measured 1050 nodes / 0.31ms, so 3000 stays well under 5ms and leaves RETURN headroom (DEC-022)
    PATH_FAIL_LIMIT: 3,
    // consecutive failures before giving up on the goal
    ACTIVE_RANGE: 640,
    // px; beyond this the FSM runs at 5 Hz and never asks for a path
    ARRIVE_EPSILON: 8,
    // px within which a path point counts as reached
    MAX_ACTIVE_ENEMIES: 8,
    // Slice 1 uses 4; more than this means the map data is wrong
    MAX_PATH_POINTS: 64,
    // capacity of a per-enemy dynamic path buffer
    DT_CLAMP_MS: 100,
    // stops a backgrounded tab from teleporting enemies on return
    /**
     * Stuck watchdog. Rule N4 skips A* whenever the target is in line of sight, but a
     * clear sight line does not prove a 20 px body fits through the diagonal seam it
     * crosses. Instead of pre-emptively restricting N4 to 3 tiles, we detect the
     * symptom (wanting to move but not moving) and fall back to a real path.
     */
    STUCK_REPATH_MS: 400,
    STUCK_PATH_PREFERENCE_MS: 2e3,
    // how long a stuck enemy keeps preferring A* over straight lines
    STUCK_PROGRESS_FRACTION: 0.25,
    // actual/desired speed below which we count as stuck
    // --- placeholder presentation (section "占位期表现", art-direction 12) ---
    BODY_COLOR: 13386820,
    // "low tier enemy"; encodes tier, never state
    INDICATOR_COLOR: 2811592,
    // contamination teal; state lives here
    SUSPICIOUS_BREATH_HZ_MIN: 1.5,
    // breathing rate at the suspicion threshold...
    SUSPICIOUS_BREATH_HZ_MAX: 3,
    // ...and at full certainty (rule R3)
    ALERT_BLINK_HZ: 3,
    // blinking = searching
    AFTERIMAGE_INTERVAL_MS: 100,
    AFTERIMAGE_LIFETIME_MS: 300,
    AFTERIMAGE_ALPHA: 0.3,
    AFTERIMAGE_SLOTS: 4,
    // ring buffer per enemy; lifetime/interval + 1
    /** Rule R5's fallback visualisation. The cone drawing itself is not implemented yet. */
    DEBUG_SHOW_VISION_CONE: false
  },
  /** Map generation */
  MAP: {
    WIDTH: 80,
    // tiles (larger to accommodate multiple fragments)
    HEIGHT: 80,
    // tiles
    /** Voronoi partitioning */
    FRAGMENT_COUNT_MIN: 4,
    FRAGMENT_COUNT_MAX: 6,
    FRAGMENT_MIN_AREA: 150,
    // minimum tiles per fragment
    /** Cellular automata */
    CA_ITERATIONS: 5,
    // smoothing passes
    CA_WALL_THRESHOLD: 4,
    // cells with >= N wall neighbors become wall
    CA_INITIAL_FILL: 0.45,
    // initial random fill ratio (lower = more open)
    /** Fracture connections between fragments */
    FRACTURE_WIDTH: 2,
    // tiles (narrow passage width)
    FRACTURE_MAX_PER_EDGE: 2
    // max connections between two adjacent fragments
  },
  /**
   * Slice 6 C1 land outline. Rectangular tile buffer; walkable land must not fill it.
   * 80×80 MAP.* numbers stay architecture placeholders — do not use them for this generator.
   */
  GENERATION: {
    BUFFER_COLS: 64,
    BUFFER_ROWS: 42,
    MAX_OUTLINE_ATTEMPTS: 28,
    LAND_FILL_MIN: 0.24,
    LAND_FILL_MAX: 0.48,
    BORDER_RING: 2,
    /** Fraction of the outer ring that may be land. Higher = island hugging the rectangle. */
    BORDER_OCCUPANCY_MAX: 0.12,
    /** Land / axis-aligned bbox. Circles sit near 0.78; filled rectangles sit near 1. */
    BBOX_FILL_MAX: 0.8,
    /**
     * Share of land cells that touch void. Large blobs naturally sit lower;
     * this only rejects near-solid blocks (a 1-cell frame around a filled rect).
     */
    ROUGHNESS_MIN: 0.08,
    /** bbox must leave at least this many leftover cells on width+height combined. */
    MIN_BBOX_SLACK: 8,
    MAX_EDGES_TOUCHING: 3,
    MAX_RUIN_ATTEMPTS: 40,
    MIN_FEATURE_SEPARATION: 7,
    WALL_RATIO_MIN: 0.018,
    WALL_RATIO_MAX: 0.22,
    /** Largest leftover open rectangle (tiles). Bigger than this reads as an empty plaza. */
    YARD_AREA_MAX: 64
  },
  /** Purification point (docs/specs/system-purification-impact.md) */
  PURIFICATION: {
    /** Spatial layout */
    MAP_COLS: 14,
    // tiles
    MAP_ROWS: 12,
    // tiles
    INTERACTION_RADIUS: 32,
    // pixels for module/rift-entrance interaction
    /** Module state */
    MODULE_INITIAL_HP: 70,
    /** Tier-0 repair cap / effect denominator baseline (DEC-064). */
    MODULE_BASE_MAX_HP: 100,
    /** Alias of MODULE_BASE_MAX_HP so older call sites still compile. */
    MODULE_MAX_HP: 100,
    /** Each thicken tier adds this many maxHp to every module. */
    MODULE_MAX_HP_PER_TIER: 15,
    /** Highest purchasable thicken tier (maxHp = 100 + 15*3 = 145). */
    MODULE_MAX_HP_TIERS: 3,
    // Thickening purchase costs are authored alongside all other growth steps
    // in data/growth-route.csv, not a separate system-constant price ladder.
    /** All three module effects use this HP reference; thickening does not raise it. */
    MODULE_EFFECT_HP_REF: 100,
    /** Starting chaos when purifier hp = 0 (full integrity → 0). */
    CHAOS_HARD_START: 50,
    REPAIR_PER_KINDLING: 4,
    // 1 kindling = this many hp (tuned for scarcity)
    /** Impact system (intensity now driven by TideSystem, see TIDE constants) */
    BASE_IMPACT_DAMAGE: 30,
    THREAT_FOCUS_RATIO: 0.65,
    // primary target gets this fraction of total damage
    FORECAST_ACCURACY: 0.8,
    // particle prediction accuracy
    /** combust defense mechanic (DEC-030): fixed threshold, not derived from
     * BASE_IMPACT_DAMAGE, so tide-driven damage swings don't shift the trigger point.
     * Value chosen to equal ~2x BASE_IMPACT_DAMAGE(30) per the CSV's "约等于2次满额冲击". */
    COMBUST_BURN_THRESHOLD: 60,
    /** Module effects */
    MAX_CORE_REDUCTION: 0.3,
    // chaosRate reduction at full hp
    MAX_STORAGE_BONUS: 0.5,
    // kindling value bonus at full hp
    /** resonate (Slice 5 gap-fill, DEC-039): "装备期间CORE和STORAGE模块效果上限各提升10%".
     * A flat bump to both caps above while at least one resonate sits in a defense slot -
     * not a multiplier, so it reads the same way the CSV states it ("+10%" alongside two
     * numbers already expressed as flat percentages). "不叠加" is enforced by storing this
     * as a single on/off flag (`GameState.isResonateBonusActive()`), not a per-item count. */
    RESONATE_MODULE_CAP_BONUS: 0.1,
    /** siphon (Slice 5 gap-fill): "装备期间所有薪柴修复模块的效率翻倍(1薪柴=8hp)" - same
     * "装备期间" derivation pattern as RESONATE_MODULE_CAP_BONUS above (owned by
     * `ContaminantSystem.syncRepairEfficiencyMult()` + `GameState`, not a per-impact
     * defense-engine effect), since the CSV names it a standing equip-state bonus rather
     * than a one-impact trigger. 4 (REPAIR_PER_KINDLING) * 2.0 = 8, matching the CSV. */
    SIPHON_REPAIR_EFFICIENCY_MULT: 2,
    /** Boundary atmosphere */
    ATMOSPHERE: {
      PARTICLE_COUNT: 50,
      // active boundary particles
      PARTICLE_ALPHA_MIN: 0.06,
      PARTICLE_ALPHA_MAX: 0.25,
      PARTICLE_SPEED: 8,
      // px/s slow inward drift
      APPARITION_INTERVAL_MIN: 8e3,
      // ms
      APPARITION_INTERVAL_MAX: 15e3,
      APPARITION_DURATION: 3e3,
      // ms (0.5s fade in + 2s hold + 0.5s fade out)
      APPARITION_MAX_SIMULTANEOUS: 3
    },
    /** Dynamic boundary shape (polar pressure blob) */
    BOUNDARY: {
      SHRINK_AT_MAX_INTENSITY: 0.72,
      // tideScale at intensity 3.0 (boundary loses up to 28%)
      PRESSURE_PRIMARY_AMP: 0.2,
      // max inward push fraction (primary Gaussian lobe)
      PRESSURE_SECONDARY_AMP: 0.1,
      // secondary lobe amplitude
      PRESSURE_LOBE_SIGMA: 0.7,
      // radians; width of each Gaussian lobe
      PRESSURE_CREST_BONUS: 0.4,
      // +40% amplitude during crest phase
      PRESSURE_EBB_FACTOR: 0.6,
      // amplitude multiplier during ebb phase
      SAFE_MARGIN_TILES: 1,
      // minimum distance from any interaction point to boundary
      GRADIENT_INNER_START: 0.8,
      // fraction of R where darkening begins
      GRADIENT_MEMBRANE_START: 0.95,
      // fraction where "membrane" teal band begins
      GRADIENT_OUTER_END: 1.15,
      // fraction where full void begins
      /**
       * B4 (Slice 5): the old BREATH_BASE_ALPHA/AMP/FREQ/CREST_FREQ_MULT/EBB_AMP_MULT
       * keys described a single global sinusoidal pulse from a "whole-boundary breathing"
       * design that DEC-028 (Slice 4.5) replaced with localized pressure impacts
       * (`src/systems/boundary-breath.ts`). Those 5 keys had zero consumers and were
       * removed; this nested object holds boundary-breath.ts's real tuning knobs
       * (previously inlined as top-of-file `const`s there) instead. Values unchanged.
       */
      BREATH: {
        SAMPLE_COUNT: 72,
        // angular resolution of the membrane/impact draw
        MAX_IMPACTS: 5,
        // max simultaneous localized impacts
        ARC_HALF_MIN: 0.4,
        // rad; narrowest impact arc half-width
        ARC_HALF_MAX: 0.8,
        // rad; widest impact arc half-width
        SPAWN_DIST_MIN: 14,
        // px; closest impact spawn distance outside the membrane
        SPAWN_DIST_MAX: 30,
        // px; farthest impact spawn distance
        IMPACT_DURATION_MIN: 1800,
        // ms; shortest single-impact lifetime
        IMPACT_DURATION_MAX: 3500,
        // ms; longest single-impact lifetime
        SPAWN_INTERVAL_MIN: 400,
        // ms; shortest gap between new impacts
        SPAWN_INTERVAL_MAX: 1200,
        // ms; longest gap between new impacts (x0.6 during crest)
        WAVE_COLOR: 936511,
        // dark desaturated teal, the inbound wave arcs
        MEMBRANE_COLOR: 1735274,
        // the boundary membrane line itself
        DEFORM_MAX_PX: 8
        // px; max inward push of the membrane at impact center
      }
    },
    /** Scene transition timing */
    IMPACT_RESULT_DISPLAY_MS: 2e3,
    SCENE_TRANSITION_DELAY_MS: 600
  },
  /**
   * Combat (docs/specs/system-combat.md, "数值结构"). Every combat number lives here.
   *
   * The system is a price list, not a fight: the point is that the player can work out
   * what swinging costs before swinging. Three of these relations carry that promise and
   * are asserted at boot by `config/invariants.ts` (K1/K2/K3/K5) - notably
   * `ENEMY_MAX_HEALTH` being an exact multiple of `PLAYER_DAMAGE`, which is what makes
   * "three hits" a fact rather than an average.
   *
   * When combat turns out too cheap in playtesting, the spec's tuning order is
   * `CHAOS.COMBAT_BONUS` and `NOISE_HIT_RADIUS` first, `ENEMY_MAX_HEALTH` second, and
   * `PLAYER_DAMAGE` never (weakening it makes combat expensive *and* unpleasant).
   */
  COMBAT: {
    // --- player attack (section "玩家攻击") ---
    PLAYER_DAMAGE: 25,
    ATTACK_COOLDOWN: 500,
    // ms, counted from the input instant, parallel to the phases
    ATTACK_RANGE: 40,
    // px centre-to-centre; must exceed ENEMY_ATTACK_RANGE (K2)
    ATTACK_HALF_ANGLE: 60,
    // deg -> a 120 deg forward sector
    ATTACK_WINDUP_MS: 100,
    // the player's side of the commitment
    ATTACK_ACTIVE_MS: 50,
    // ~3 frames; exists to tolerate frame jitter, not to widen the hit
    ATTACK_RECOVERY_MS: 70,
    ATTACK_SLOW_MS: 220,
    // derived: windup + active + recovery (asserted, not free)
    ATTACK_SELF_SLOW: 0.35,
    // move speed while swinging - the "cost" that lands on feel
    ATTACK_MIN_ANGLE_BYPASS: 16,
    // px within which the angle test is meaningless and skipped
    /** Key name in `Phaser.Input.Keyboard.KeyCodes`. Read by RiftScene, which owns input. */
    ATTACK_KEY: "SPACE",
    // --- infiltrator (section "敌人（渗透体）") ---
    ENEMY_MAX_HEALTH: 75,
    // = 3 x PLAYER_DAMAGE exactly (K1, DEC-012)
    ENEMY_DAMAGE_BASE: 15,
    ENEMY_ATTACK_RANGE: 38,
    // px; between AI.STANDOFF_DISTANCE and ATTACK_RANGE (K2)
    ENEMY_ATTACK_HALF_ANGLE: 60,
    // deg; symmetric with the player's
    ENEMY_ATTACK_WINDUP_MS: 350,
    // the player's dodge window - the whole of "controllable" (K3)
    ENEMY_ATTACK_COOLDOWN_MS: 1200,
    ENEMY_FIRST_ATTACK_DELAY_MS: 300,
    // "caught up with you" and "hit you" stay two events
    ENEMY_ATTACK_TOKENS: 2,
    // enemies allowed in windup at once; caps unavoidable damage
    ENEMY_HIT_FLASH_MS: 80,
    ENEMY_DEATH_FX_MS: 180,
    // presentation only; the enemy is gone from logic at 0 ms
    // --- player health and hits (section "玩家生命值与受击") ---
    PLAYER_IFRAME_MS: 400,
    // stops two enemies resolving on one frame for 30 damage
    PLAYER_HIT_FLASH_MS: 100,
    // --- noise: the exposure half of the price (section "噪声") ---
    NOISE_SWING_RADIUS: 96,
    // px (3 tiles), 'suspicious' - a whiff is heard, not billed
    NOISE_HIT_RADIUS: 160,
    // px (5 tiles), 'alert' - the main reason a fight is loud
    NOISE_KILL_RADIUS: 192,
    // px (6 tiles), 'alert'
    /**
     * Placeholder presentation (spec V2). White is on loan here: it currently means
     * "player / extraction point" in art-direction 12, and using thin white lines and
     * flashes for combat actions is still awaiting art sign-off (spec escalate 1 and 2).
     * Treat these as stand-ins, not as the visual language.
     */
    FX_COLOR: 16777215,
    ATTACK_FAN_FX_MS: 60,
    // how long the swing outline stays up (spec V2)
    PLAYER_FLASH_PAD: 6,
    // px the hit flash overshoots the body; see report on white-on-white
    FX_POOL_SIZE: 12
    // preallocated flash/death sprites: 8 enemies + headroom
  },
  /**
   * Contamination lexicon (DEC-076). Morph tables stay in CSV.
   * These are system constants: core HP, chaos prices, draw retry, encounter timing.
   */
  CONTAMINATION: {
    CORE_MAX_HEALTH: 50,
    ADJACENT_STRIKE_DAMAGE: 15,
    ADJACENT_STRIKE_WINDUP_MS: 350,
    PAINT_STEP_CHAOS_REST: 2,
    PAINT_STEP_CHAOS_INFLATED: 4,
    VOLUME_CHAOS_PER_SEC: 1,
    VOLUME_SIGHT_MULT: 0.7,
    DRAW_RETRY_LIMIT: 12,
    ENCOUNTER_COOLDOWN_MS: 6e4,
    ENCOUNTER_GAP_MS: 2500,
    ENCOUNTER_HOLD_MS: 2500,
    VOLUME_DEPTH: 40,
    COLONY_NUCLEUS_COUNT_MIN: 2,
    COLONY_NUCLEUS_COUNT_MAX: 3,
    COLONY_NUCLEUS_MIN_TILE_GAP: 3
  },
  /** Audio */
  AUDIO: {
    MAX_SIMULTANEOUS_SFX: 8,
    DEFAULT_SFX_VOLUME: 0.7,
    DEFAULT_BGM_VOLUME: 0.4,
    DEFAULT_AMBIENT_VOLUME: 0.5
  },
  /** Tide system (docs/specs/system-growth-tide.md, section T) */
  TIDE: {
    TIDES: [
      { floor: 1, peak: 1.6, riseCycles: 3, crestCycles: 1, ebbCycles: 2, ebbTarget: 1.2 },
      { floor: 1.2, peak: 2, riseCycles: 4, crestCycles: 1, ebbCycles: 2, ebbTarget: 1.5 },
      { floor: 1.5, peak: 2.4, riseCycles: 4, crestCycles: 2, ebbCycles: 2, ebbTarget: 1.8 },
      { floor: 1.8, peak: 2.8, riseCycles: 4, crestCycles: 2, ebbCycles: 3, ebbTarget: 2 },
      { floor: 2, peak: 3, riseCycles: 5, crestCycles: Infinity, ebbCycles: 0, ebbTarget: 2 }
    ],
    CREST_CHARGE_COST: 3,
    // impact charge cost during Crest phase
    NORMAL_CHARGE_COST: 1,
    // impact charge cost during Rise/Ebb phases
    TRANSFORM_THRESHOLD: 3
    // charges needed to transform defense -> tool
  },
  // Growth / permanent upgrades (docs/specs/system-growth-tide.md, section G):
  // Definitions come from data/upgrades.csv; all step costs come from
  // data/growth-route.csv (including thickening). Both generate upgrade-data.ts
  // under the CSV source rule — no constants block here
  // by design; growth-system.ts reads UPGRADE_DATA directly.
  /** Contaminant system (docs/specs/system-growth-tide.md, section CN) */
  CONTAMINANT: {
    NODES_PER_MAP: 3,
    // contaminant pickup nodes per rift map
    RARITY_WEIGHTS: { common: 60, fine: 30, rare: 10 },
    DEFENSE_SLOTS: 1,
    // base slot; each growth_defense_slot level adds +1
    SORTIE_SLOTS: 3,
    // base slots (2 active + 1 passive); growth_sortie_slot adds +1 active
    MAX_DEFENSE_SLOTS: 4,
    // DEFENSE_SLOTS + max growth_defense_slot bonus (maxLevel 3)
    MAX_SORTIE_SLOTS: 4,
    // SORTIE_SLOTS + max growth_sortie_slot bonus (maxLevel 1)
    USES: { common: 5, fine: 3, rare: 2 },
    // uses remaining after transformation
    /** echo defense mechanic: "单件因此最多+2" — per-tool cap on echo bonus grants. */
    ECHO_MAX_TOOL_USE_BONUS: 2,
    /**
     * Hotkeys for the active sortie slots, in slot order. The passive slot (always the
     * last unlocked slot, see `contaminantSystem.getSortiePassiveSlotIndex()`) never gets
     * an entry here - it has no hotkey by design. G was picked for the 3rd slot
     * (growth_sortie_slot, Slice 5 T5) because it sits directly beside F on the keyboard,
     * the same "one key past the movement cluster" reach as Q/F already use, and every
     * other neighbour (E/R/T) is already taken by extraction/restart/nothing-reserved-but-
     * awkward. Single source of truth for both the RiftScene binding and any UI that needs
     * to render the real key label.
     */
    SORTIE_ACTIVE_KEYS: ["Q", "F", "G"]
  },
  /** Purification stability (docs/specs/system-growth-tide.md, section S) */
  STABILITY: {
    MAX: 100,
    GAIN_EXTRACT: 1,
    // successful extraction (calibrated: ~35 cycles to cap)
    GAIN_GROWTH: 1,
    // purchased an upgrade
    GAIN_CREST_SURVIVED: 3,
    // survived a full Crest with no module at zero
    GAIN_TIDE_ADVANCE: 5,
    // tide advanced to next number
    LOSS_MODULE_ZERO: -1
    // a module reached 0 hp
  },
  /**
   * Fine/Rare active+passive tool numbers not already carried by
   * `src/generated/contaminant-data.ts` (radius/duration/uses read straight from the CSV
   * at the point of use instead of being re-hardcoded here - see `docs/design-notes/
   * slice3-sortie-tools.md`). Everything below is either a multiplier/amount the CSV
   * description states in prose (`data/contaminants.csv`, `description_tool` column) or,
   * where flagged, a placeholder-tier number the CSV leaves unspecified (Slice 5 T1).
   */
  TOOLS: {
    /** compress: "半径2格内敌人移速-60%" */
    COMPRESS_SPEED_MULT: 0.4,
    /** resonate: "弹回3格并眩晕2秒" */
    RESONATE_KNOCKBACK_PX: 96,
    RESONATE_STUN_MS: 2e3,
    /** overwrite: "感知范围缩小50%" */
    OVERWRITE_PERCEPTION_MULT: 0.5,
    /** combust: "感知范围-50%"(烈焰遮蔽视线) */
    COMBUST_PERCEPTION_MULT: 0.5,
    /** combust: "每秒受到持续伤害" - CSV gives no amount; placeholder tuned so an enemy
     * that stays the full 8s duration dies (75 hp / 15 = 5 ticks), matching the tool's
     * rare-tier power level. Flagged for design confirmation (see delivery report). */
    COMBUST_DAMAGE_PER_TICK: 15,
    COMBUST_TICK_MS: 1e3,
    /** mirror: "被敌人接触后碎裂消失" - CSV gives no contact radius; placeholder tuned to
     * roughly one enemy body width. Flagged for design confirmation. */
    MIRROR_CONTACT_RADIUS: 20,
    /** abyss: "使用后5秒内混乱增速+50%" - a second timing value the CSV's single
     * `tool_duration_ms` column cannot carry (that field holds the 10s reveal instead). */
    ABYSS_CHAOS_BOOST_MULT: 1.5,
    ABYSS_CHAOS_BOOST_MS: 5e3,
    /** siphon: "吸取2点薪柴且...混乱值增速减半" */
    SIPHON_KINDLING_GAIN: 2,
    SIPHON_CHAOS_REDUCTION_MULT: 0.5
  },
  /** Persistent save (docs/specs/system-growth-tide.md, section P) */
  SAVE: {
    KEY: "coh-save-v1",
    VERSION: 2
  }
};

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/systems/contaminant-catalog.ts
var CURRENT_CATALOG_VERSION = "contaminant-v1";
function getCatalogDefinition(c) {
  if (c.type !== "catalog" || c.catalog?.catalogVersion !== CURRENT_CATALOG_VERSION) return null;
  return Object.prototype.hasOwnProperty.call(CATALOG_ITEMS, c.catalog.definitionId) ? CATALOG_ITEMS[c.catalog.definitionId] : null;
}
function getCatalogItemWeight(c) {
  const def = getCatalogDefinition(c);
  if (!def || !c.catalog) throw Error("Unknown catalog weight");
  return c.catalog.identification === "unidentified" ? CATALOG_APPEARANCES[c.catalog.appearanceId].weight : def.weight;
}
function getCatalogAbilityByDefinition(definitionId, catalogVersion) {
  const def = catalogVersion === CURRENT_CATALOG_VERSION && Object.prototype.hasOwnProperty.call(CATALOG_ITEMS, definitionId) ? CATALOG_ITEMS[definitionId] : void 0;
  if (!def?.familyId || !def.slot || !def.scope) return null;
  return {
    familyId: def.familyId,
    slot: def.slot,
    scope: def.scope,
    paramKey: def.paramKey,
    paramValue: def.paramValue,
    durationMs: def.durationMs,
    rangePx: def.rangePx,
    baseUses: def.baseUses,
    definitionId: def.id,
    catalogVersion: CURRENT_CATALOG_VERSION
  };
}
function validateResolvedCatalogAbility(value) {
  if (!value || typeof value !== "object") return false;
  const r = value;
  if (typeof r.definitionId !== "string" || typeof r.catalogVersion !== "string") return false;
  const expected = getCatalogAbilityByDefinition(r.definitionId, r.catalogVersion);
  return !!expected && Object.keys(r).length === Object.keys(expected).length && Object.entries(expected).every(([key, v]) => r[key] === v);
}
function getCatalogRuntimeAbility(c) {
  return c.type === "catalog" && c.catalog?.identification === "revealed" && c.stage === "tool" ? getCatalogAbilityByDefinition(c.catalog.definitionId, c.catalog.catalogVersion) : null;
}
function getContaminantSlot(c) {
  if (c.type === "catalog") return getCatalogRuntimeAbility(c)?.slot ?? null;
  return CONTAMINANT_DATA[c.type]?.toolType ?? null;
}
function getContaminantOffering(c) {
  if (c.type === "catalog") {
    const profile = c.catalog && CATALOG_OFFERINGS[c.catalog.offeringProfileId];
    if (!profile) throw Error("Unknown catalog offering profile");
    return { reduction: profile.effect === "impact_damage_reduction" ? profile.amount : 0, chargeMultiplier: profile.chargeMultiplier, summary: profile.description, description: profile.description };
  }
  const def = CONTAMINANT_DATA[c.type];
  return { reduction: def.defenseReduction, chargeMultiplier: def.defenseChargeMult, summary: def.summaryDefense, description: def.descriptionDefense };
}
function getCatalogMaxUses(c) {
  const def = getCatalogDefinition(c);
  if (!def) throw Error("Unknown catalog item");
  if (def.class === "inert") return 0;
  const quality = c.quality && CATALOG_QUALITIES[c.quality];
  if (!quality) throw Error("Missing catalog quality");
  return def.baseUses + quality.extraUses;
}
function getContaminantLifecycleRules(c) {
  if (c.type !== "catalog") throw Error("Legacy max uses are owned by contaminant-quality");
  return { offeringCharges: GAME_CONSTANTS.TIDE.TRANSFORM_THRESHOLD, maxUses: getCatalogMaxUses(c), chargeMultiplier: getContaminantOffering(c).chargeMultiplier };
}
function createCatalogContaminant(input) {
  if (!Object.prototype.hasOwnProperty.call(CATALOG_ITEMS, input.definitionId) || !CATALOG_APPEARANCES[input.appearanceId] || !CATALOG_OFFERINGS[input.offeringProfileId] || !CATALOG_QUALITIES[input.quality]) throw Error("Unknown catalog identity");
  if (!input.id || !Number.isSafeInteger(input.acquiredOrdinal) || input.acquiredOrdinal < 0) throw Error("Invalid catalog identity");
  return {
    id: input.id,
    type: "catalog",
    rarity: "common",
    quality: input.quality,
    stage: "defense",
    impactCharges: 0,
    usesRemaining: 0,
    catalog: { catalogVersion: CURRENT_CATALOG_VERSION, definitionId: input.definitionId, appearanceId: input.appearanceId, offeringProfileId: input.offeringProfileId, acquiredOrdinal: input.acquiredOrdinal, identification: "unidentified" }
  };
}
function validateCatalogContaminant(c) {
  const def = getCatalogDefinition(c), identity = c.catalog;
  if (!def || !identity || !Object.prototype.hasOwnProperty.call(CATALOG_APPEARANCES, identity.appearanceId) || !Object.prototype.hasOwnProperty.call(CATALOG_OFFERINGS, identity.offeringProfileId) || !c.quality || !Object.prototype.hasOwnProperty.call(CATALOG_QUALITIES, c.quality) || !Number.isSafeInteger(identity.acquiredOrdinal) || identity.acquiredOrdinal < 0 || !["unidentified", "revealed"].includes(identity.identification) || !Number.isFinite(c.impactCharges) || c.impactCharges < 0 || !Number.isSafeInteger(c.usesRemaining) || c.usesRemaining < 0 || c.usesRemaining > getCatalogMaxUses(c)) return false;
  if (identity.identification === "unidentified") return c.stage === "defense" && c.usesRemaining === 0 && identity.revealedAt === void 0 && identity.revealReceiptId === void 0 && identity.runBinding === void 0;
  if (!Number.isFinite(identity.revealedAt) || identity.revealedAt < 0 || typeof identity.revealReceiptId !== "string" || !identity.revealReceiptId) return false;
  if (def.class === "inert") return c.stage === "inert" && c.usesRemaining === 0 && !identity.runBinding;
  if (c.stage !== "tool") return false;
  const binding = identity.runBinding;
  if (binding && (binding.consumed !== true || typeof binding.runId !== "string" || !binding.runId || !["sight", "capacity"].includes(binding.familyId) || binding.familyId !== def.familyId || binding.benefit !== def.paramValue)) return false;
  return c.usesRemaining > 0 || !!binding;
}
function getBoundCatalogPassive(c, runId) {
  if (c.type !== "catalog" || c.stage !== "tool" || c.catalog?.identification !== "revealed") return null;
  return c.catalog.runBinding?.runId === runId ? c.catalog.runBinding : null;
}
function projectItemForPlayer(c) {
  const qualityId = c.quality ?? { common: "ordinary", fine: "good", rare: "fine" }[c.rarity];
  const offering = getContaminantOffering(c);
  const shared = { instanceId: c.id, qualityId, offeringSummary: offering.summary, offeringCharges: GAME_CONSTANTS.TIDE.TRANSFORM_THRESHOLD, impactCharges: c.impactCharges };
  if (c.type === "catalog") {
    const def2 = getCatalogDefinition(c);
    if (!def2 || !c.catalog) throw Error("Invalid catalog projection");
    const shell = CATALOG_APPEARANCES[c.catalog.appearanceId];
    if (c.catalog.identification === "unidentified") return { ...shared, identification: "unidentified", name: shell.name, iconRef: { kind: "appearance", id: shell.iconId }, weight: shell.weight, summary: offering.summary, description: offering.description, acquiredOrdinal: c.catalog.acquiredOrdinal, slot: null, inert: false };
    return { ...shared, identification: "revealed", name: def2.name, iconRef: { kind: "item", id: def2.iconId, appearanceId: c.catalog.appearanceId }, weight: def2.weight, summary: def2.description, description: def2.description, acquiredOrdinal: c.catalog.acquiredOrdinal, slot: def2.slot, inert: def2.class === "inert", ...def2.class === "inert" ? {} : { usesRemaining: c.usesRemaining, maxUses: getCatalogMaxUses(c) } };
  }
  const def = CONTAMINANT_DATA[c.type];
  return { ...shared, identification: "legacy_known", name: c.stage === "tool" ? def.displayNameTool : def.displayNameDefense, iconRef: { kind: "legacy", id: c.type }, weight: INVENTORY_RULES.contaminant_weight_tenths, summary: c.stage === "tool" ? def.summaryTool : def.summaryDefense, description: c.stage === "tool" ? def.descriptionTool : def.descriptionDefense, acquiredOrdinal: 0, slot: c.stage === "tool" ? def.toolType : null, inert: false, ...c.stage === "tool" ? { usesRemaining: c.usesRemaining } : {} };
}

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/systems/ai/runtime-validation.ts
function runtimeRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function runtimeNumber(value, minimum = -Infinity, maximum = Infinity) {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}
function runtimeInteger(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  return runtimeNumber(value, minimum, maximum) && Number.isSafeInteger(value);
}
function runtimeVector(value) {
  return runtimeRecord(value) && runtimeNumber(value.x) && runtimeNumber(value.y);
}
function runtimeStrings(value, maximum) {
  return Array.isArray(value) && value.length <= maximum && value.every((id) => typeof id === "string" && id.length > 0) && new Set(value).size === value.length;
}

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/systems/tool-targeting.ts
function selectNearestVisibleTarget(origin, targets, policy) {
  if (!finitePoint(origin)) return null;
  const limit = policy.maxDistance ?? Infinity;
  if (Number.isNaN(limit) || limit < 0) return null;
  let distanceSquared = limit * limit;
  let selected = null;
  for (const target of targets) {
    if (!policy.isAlive(target) || !policy.isVisible(target)) continue;
    const position = policy.getPosition(target);
    if (!finitePoint(position)) continue;
    const dx = position.x - origin.x;
    const dy = position.y - origin.y;
    const candidateDistance = dx * dx + dy * dy;
    if (candidateDistance > distanceSquared || selected !== null && candidateDistance === distanceSquared) continue;
    if (!policy.hasLineOfSight(origin, position)) continue;
    distanceSquared = candidateDistance;
    selected = target;
  }
  return selected;
}
function finitePoint(point) {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}
function bodyFits(grid2, x, y, halfW, halfH, epsilon) {
  const left = x - halfW;
  const right = x + halfW;
  const top = y - halfH;
  const bottom = y + halfH;
  if (left < 0 || top < 0 || right > grid2.cols * grid2.tileSize || bottom > grid2.rows * grid2.tileSize) return false;
  for (let row = Math.floor((top + epsilon) / grid2.tileSize); row <= Math.floor((bottom - epsilon) / grid2.tileSize); row++) {
    for (let col = Math.floor((left + epsilon) / grid2.tileSize); col <= Math.floor((right - epsilon) / grid2.tileSize); col++) {
      if (!grid2.isWalkable(col, row)) return false;
    }
  }
  return true;
}
function intersectRayBox(origin, dx, dy, left, top, right, bottom, out) {
  if (dx === 0 && (origin.x < left || origin.x > right) || dy === 0 && (origin.y < top || origin.y > bottom)) return false;
  const tx1 = dx === 0 ? -Infinity : (left - origin.x) / dx;
  const tx2 = dx === 0 ? Infinity : (right - origin.x) / dx;
  const ty1 = dy === 0 ? -Infinity : (top - origin.y) / dy;
  const ty2 = dy === 0 ? Infinity : (bottom - origin.y) / dy;
  out.enter = Math.max(0, Math.min(tx1, tx2), Math.min(ty1, ty2));
  out.exit = Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2));
  return out.exit >= out.enter;
}
function findSoundLureLanding(origin, direction, maxDistance, grid2, minDistance, bodyQueries) {
  if (!finitePoint(origin) || !finitePoint(direction) || !Number.isFinite(maxDistance) || maxDistance <= 0 || !Number.isFinite(minDistance) || minDistance < 0 || grid2.tileSize <= 0) return null;
  const length = Math.hypot(direction.x, direction.y);
  if (!length || !Number.isFinite(length)) return null;
  const dx = direction.x / length, dy = direction.y / length;
  if (bodyQueries) {
    const travel2 = maxDistance * bodyQueries.displacementFraction(origin, 1e-3, 1e-3, dx * maxDistance, dy * maxDistance);
    const safeTravel = travel2 < maxDistance ? Math.max(0, travel2 - 1) : travel2;
    return safeTravel >= minDistance && safeTravel > 0 ? { x: origin.x + dx * safeTravel, y: origin.y + dy * safeTravel } : null;
  }
  const col = Math.floor(origin.x / grid2.tileSize), row = Math.floor(origin.y / grid2.tileSize);
  if (col < 0 || row < 0 || col >= grid2.cols || row >= grid2.rows || !grid2.isWalkable(col, row)) return null;
  let travel = maxDistance;
  const interval = { enter: 0, exit: 0 };
  const size = grid2.tileSize;
  const x2 = origin.x + dx * travel, y2 = origin.y + dy * travel;
  for (let r = Math.max(-1, Math.floor(Math.min(origin.y, y2) / size)); r <= Math.min(grid2.rows, Math.floor(Math.max(origin.y, y2) / size)); r++) {
    for (let c = Math.max(-1, Math.floor(Math.min(origin.x, x2) / size)); c <= Math.min(grid2.cols, Math.floor(Math.max(origin.x, x2) / size)); c++) {
      if (c >= 0 && r >= 0 && c < grid2.cols && r < grid2.rows && grid2.isWalkable(c, r)) continue;
      if (intersectRayBox(origin, dx, dy, c * size, r * size, (c + 1) * size, (r + 1) * size, interval)) {
        travel = Math.min(travel, interval.enter - 1);
      }
    }
  }
  return travel >= minDistance && travel > 0 ? { x: origin.x + dx * travel, y: origin.y + dy * travel } : null;
}
function sweepGroundDash(input) {
  const { origin, destination, grid: grid2 } = input;
  const halfW = input.bodyHalfWidth ?? 10, halfH = input.bodyHalfHeight ?? 10;
  const distance = Math.hypot(destination.x - origin.x, destination.y - origin.y);
  if (!finitePoint(origin) || !finitePoint(destination) || !Number.isFinite(distance) || distance === 0 || halfW <= 0 || halfH <= 0 || grid2.tileSize <= 0 || !(input.bodyQueries?.supports(origin, halfW, halfH) ?? bodyFits(grid2, origin.x, origin.y, halfW, halfH, 1e-6))) return { ...origin };
  const dx = (destination.x - origin.x) / distance, dy = (destination.y - origin.y) / distance;
  const interval = { enter: 0, exit: 0 };
  let travel = input.bodyQueries ? distance * input.bodyQueries.displacementFraction(origin, halfW, halfH, destination.x - origin.x, destination.y - origin.y) : distance;
  const hitBox = (left, top, right, bottom) => {
    if (intersectRayBox(
      origin,
      dx,
      dy,
      left - halfW + 1e-6,
      top - halfH + 1e-6,
      right + halfW - 1e-6,
      bottom + halfH - 1e-6,
      interval
    ) && interval.exit > 1e-6) {
      travel = Math.min(travel, Math.max(0, interval.enter - 1e-5));
    }
  };
  const size = grid2.tileSize;
  if (!input.bodyQueries) for (let r = Math.max(-1, Math.floor((Math.min(origin.y, destination.y) - halfH) / size)); r <= Math.min(grid2.rows, Math.floor((Math.max(origin.y, destination.y) + halfH) / size)); r++) {
    for (let c = Math.max(-1, Math.floor((Math.min(origin.x, destination.x) - halfW) / size)); c <= Math.min(grid2.cols, Math.floor((Math.max(origin.x, destination.x) + halfW) / size)); c++) {
      if (c >= 0 && r >= 0 && c < grid2.cols && r < grid2.rows && grid2.isWalkable(c, r)) continue;
      hitBox(c * size, r * size, (c + 1) * size, (r + 1) * size);
    }
  }
  for (const body of input.bodies ?? []) hitBox(
    body.position.x - body.halfWidth,
    body.position.y - body.halfHeight,
    body.position.x + body.halfWidth,
    body.position.y + body.halfHeight
  );
  if (input.isVisible) for (let step = 0; step <= Math.ceil(travel); step++) {
    const d = Math.min(step, travel);
    if (!input.isVisible({ x: origin.x + dx * d, y: origin.y + dy * d })) {
      travel = Math.max(0, d - 1);
      break;
    }
  }
  return { x: origin.x + dx * travel, y: origin.y + dy * travel };
}
function findStitchPlacement(origin, direction, distance, length, grid2, hasLineOfSight2) {
  const magnitude = Math.hypot(direction.x, direction.y);
  if (!finitePoint(origin) || !finitePoint(direction) || !Number.isFinite(magnitude) || magnitude === 0 || !Number.isFinite(distance) || distance < 0 || !Number.isFinite(length) || length <= 0) return null;
  const dx = direction.x / magnitude, dy = direction.y / magnitude;
  const centre = { x: origin.x + dx * distance, y: origin.y + dy * distance };
  const a = { x: centre.x - dy * length / 2, y: centre.y + dx * length / 2 };
  const b = { x: centre.x + dy * length / 2, y: centre.y - dx * length / 2 };
  const interval = { enter: 0, exit: 0 };
  const rayX = (b.x - a.x) / length, rayY = (b.y - a.y) / length;
  for (let r = Math.floor(Math.min(a.y, b.y) / grid2.tileSize); r <= Math.floor(Math.max(a.y, b.y) / grid2.tileSize); r++) {
    for (let c = Math.floor(Math.min(a.x, b.x) / grid2.tileSize); c <= Math.floor(Math.max(a.x, b.x) / grid2.tileSize); c++) {
      if (c >= 0 && r >= 0 && c < grid2.cols && r < grid2.rows && grid2.isWalkable(c, r)) continue;
      if (intersectRayBox(
        a,
        rayX,
        rayY,
        c * grid2.tileSize,
        r * grid2.tileSize,
        (c + 1) * grid2.tileSize,
        (r + 1) * grid2.tileSize,
        interval
      ) && interval.enter <= length && interval.exit >= 0) return null;
    }
  }
  const samples = Math.ceil(length);
  for (let i = 0; i <= samples; i++) {
    const p = { x: a.x + (b.x - a.x) * i / samples, y: a.y + (b.y - a.y) * i / samples };
    const col = Math.floor(p.x / grid2.tileSize), row = Math.floor(p.y / grid2.tileSize);
    if (col < 0 || row < 0 || col >= grid2.cols || row >= grid2.rows || !grid2.isWalkable(col, row) || !hasLineOfSight2(origin, p)) return null;
  }
  return { pointA: a, pointB: b };
}
function crossesToolLine(previous, current, line) {
  const { pointA: a, pointB: b } = line;
  const lx = b.x - a.x, ly = b.y - a.y;
  const before = lx * (previous.y - a.y) - ly * (previous.x - a.x);
  const after = lx * (current.y - a.y) - ly * (current.x - a.x);
  if (before === 0 || before > 0 && after > 0 || before < 0 && after < 0) return false;
  const moveX = current.x - previous.x, moveY = current.y - previous.y;
  const denominator = moveX * ly - moveY * lx;
  if (Math.abs(denominator) < 1e-9) return false;
  const t = ((a.x - previous.x) * ly - (a.y - previous.y) * lx) / denominator;
  const u = ((a.x - previous.x) * moveY - (a.y - previous.y) * moveX) / denominator;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}
function collectToolRevealSnapshot(origin, range, grid2, enemyPositions, nodePositions, corePositions, bodyQueries) {
  const empty = { enemyPositions: [], nodePositions: [] };
  if (!finitePoint(origin) || !Number.isFinite(range) || range <= 0 || grid2.tileSize <= 0) return empty;
  const col = Math.floor(origin.x / grid2.tileSize), row = Math.floor(origin.y / grid2.tileSize);
  if (col < 0 || row < 0 || col >= grid2.cols || row >= grid2.rows) return empty;
  const costs = /* @__PURE__ */ new Map();
  const queue = [];
  if (grid2.isWalkable(col, row)) {
    queue.push(row * grid2.cols + col);
    costs.set(queue[0], 0);
  } else if (bodyQueries?.supports(origin, 10, 10)) {
    for (let y = Math.max(0, row - 1); y <= Math.min(grid2.rows - 1, row + 1); y++) for (let x = Math.max(0, col - 1); x <= Math.min(grid2.cols - 1, col + 1); x++) {
      if (!grid2.isWalkable(x, y)) continue;
      const dx = (x + 0.5) * grid2.tileSize - origin.x, dy = (y + 0.5) * grid2.tileSize - origin.y, cost = Math.hypot(dx, dy);
      if (cost <= range && bodyQueries.displacementFraction(origin, 1e-3, 1e-3, dx, dy) === 1) {
        const id = y * grid2.cols + x;
        costs.set(id, cost);
        queue.push(id);
      }
    }
  } else return empty;
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i], cost = costs.get(cell);
    if (cost + grid2.tileSize > range) continue;
    const x = cell % grid2.cols, y = Math.floor(cell / grid2.cols);
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= grid2.cols || ny >= grid2.rows || !grid2.isWalkable(nx, ny)) continue;
      const next = ny * grid2.cols + nx;
      if (!costs.has(next)) {
        costs.set(next, cost + grid2.tileSize);
        queue.push(next);
      }
    }
  }
  const filter = (positions) => positions.filter((p) => {
    if (!finitePoint(p) || Math.hypot(p.x - origin.x, p.y - origin.y) > range) return false;
    const x = Math.floor(p.x / grid2.tileSize), y = Math.floor(p.y / grid2.tileSize);
    return x >= 0 && y >= 0 && x < grid2.cols && y < grid2.rows && costs.has(y * grid2.cols + x);
  }).map((p) => ({ x: p.x, y: p.y }));
  return {
    enemyPositions: filter(enemyPositions),
    nodePositions: filter(nodePositions),
    ...corePositions ? { corePositions: filter(corePositions) } : {}
  };
}

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/systems/tool-body-echo.ts
var serial = 0;
function validateBodyEchoRuntimeState(value) {
  if (!runtimeRecord(value) || !["mirror", "memory", "freeze", "phase"].includes(value.mode) || !runtimeInteger(value.width, 1, 512) || !runtimeInteger(value.height, 1, 512) || !runtimeNumber(value.originX, -10, 10) || !runtimeNumber(value.originY, -10, 10) || !runtimeNumber(value.scaleX, -100, 100) || !runtimeNumber(value.scaleY, -100, 100) || typeof value.rgba !== "string" || value.rgba.length !== Math.ceil(value.width * value.height * 4 / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value.rgba)) return false;
  try {
    return atob(value.rgba).length === value.width * value.height * 4;
  } catch {
    return false;
  }
}
function captureBodyEcho(scene2, source, mode) {
  if (!scene2.textures?.exists(source.textureKey)) return null;
  const frame = scene2.textures.getFrame(source.textureKey, source.frame);
  if (!frame?.source?.image || !frame.realWidth || !frame.realHeight) return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = frame.realWidth;
    canvas.height = frame.realHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(
      frame.source.image,
      frame.cutX,
      frame.cutY,
      frame.cutWidth,
      frame.cutHeight,
      frame.x,
      frame.y,
      frame.cutWidth,
      frame.cutHeight
    );
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let bytes = "";
    for (const byte of pixels) bytes += String.fromCharCode(byte);
    return restoreBodyEcho(scene2, {
      mode,
      width: canvas.width,
      height: canvas.height,
      originX: source.originX,
      originY: source.originY,
      scaleX: source.scaleX ?? 1,
      scaleY: source.scaleY ?? 1,
      rgba: btoa(bytes)
    });
  } catch {
    return null;
  }
}
function restoreBodyEcho(scene2, saved) {
  if (!saved || !validateBodyEchoRuntimeState(saved)) return null;
  const snapshot = { ...saved };
  const { width, height, mode } = snapshot;
  const source = snapshot;
  const keys = [];
  const layers = [];
  let disposed = false;
  const destroy = () => {
    if (disposed) return;
    disposed = true;
    scene2.events?.off("shutdown", destroy);
    scene2.events?.off("destroy", destroy);
    layers.forEach((layer) => layer.destroy());
    keys.forEach((key) => {
      if (scene2.textures.exists(key)) scene2.textures.remove(key);
    });
  };
  try {
    const bytes = atob(snapshot.rgba);
    const pixels = Uint8ClampedArray.from(bytes, (byte) => byte.charCodeAt(0));
    let top = height, bottom = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] > 24) {
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    const foot = bottom - (bottom - top) * 0.2;
    for (let band = 0; band < 3; band++) {
      const key = `tool-body-${++serial}`;
      const texture = scene2.textures.createCanvas(key, width, height);
      if (!texture) {
        destroy();
        return null;
      }
      keys.push(key);
      const ctx = texture.context;
      const output2 = ctx.createImageData(width, height);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        if (pixels[index + 3] < 24) continue;
        const cluster = (Math.floor(x / 3) * 17 + Math.floor(y / 3) * 29) % 13;
        const layer = y >= foot ? 0 : Math.floor((y - top + Math.floor(x / 4) % 3) / 5) % 3;
        if (layer !== band) continue;
        if (mode === "mirror" && cluster < 3 || mode === "memory" && cluster < 6) continue;
        const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1 || !pixels[index - 4 + 3] || !pixels[index + 4 + 3] || !pixels[index - width * 4 + 3] || !pixels[index + width * 4 + 3];
        if (mode === "freeze" && (!edge || cluster < 4) && (y + Math.floor(x / 4)) % 13 !== 0) continue;
        const light = (pixels[index] * 0.3 + pixels[index + 1] * 0.5 + pixels[index + 2] * 0.2) / 255;
        const level = Math.floor(light * 3) / 3;
        const base = mode === "freeze" ? 96 : mode === "memory" ? 42 : 56;
        output2.data[index] = base + level * 52;
        output2.data[index + 1] = base + 17 + level * 65;
        output2.data[index + 2] = base + 12 + level * 55;
        output2.data[index + 3] = pixels[index + 3];
      }
      ctx.putImageData(output2, 0, 0);
      texture.refresh();
      layers.push(scene2.add.image(0, 0, key).setOrigin(source.originX, source.originY).setScale(source.scaleX ?? 1, source.scaleY ?? 1).setVisible(false));
    }
    scene2.events?.once("shutdown", destroy);
    scene2.events?.once("destroy", destroy);
    return {
      destroy,
      exportRuntimeState: () => ({ ...snapshot }),
      update(position, progress, depth) {
        if (disposed) return;
        const p = Math.max(0, Math.min(1, progress));
        const fade = mode === "phase" ? Math.min(1, (1 - p) / 0.15) : mode === "freeze" ? Math.min(1, (1 - p) / 0.08) : Math.min(1, (1 - p) / 0.16);
        layers.forEach((layer, band) => {
          const offset = band === 0 ? 0 : band === 1 ? -1 : 1;
          const shift = mode === "phase" ? Math.round(offset * 4 * (1 - p) ** 2) : offset;
          layer.setPosition(Math.round(position.x) + shift, Math.round(position.y)).setDepth(depth + band * 1e-3).setVisible(fade > 0).setAlpha(fade * (mode === "memory" ? 0.52 : mode === "freeze" ? 0.78 : 0.72));
        });
      }
    };
  } catch {
    destroy();
    return null;
  }
}

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/art/contaminant-icons.ts
var PALETTE = { s: "#272d2b", d: "#444d47", m: "#687366", l: "#939b85", h: "#bdc2a4", t: "#245a50", g: "#398a72", b: "#78b79a" };
var CONTAMINANT_ART_QUALITIES = ["ordinary", "good", "fine", "excellent"];
var Pixels = class {
  constructor(size = 24) {
    this.size = size;
    this.cells = Array(size * size);
  }
  cells;
  coord(v) {
    return Math.round(v * this.size / 24);
  }
  dot(x, y, c) {
    const a = this.coord(x), b = this.coord(y), w = Math.max(1, this.coord(x + 1) - a), h = Math.max(1, this.coord(y + 1) - b);
    for (let j = b; j < b + h; j++) for (let i = a; i < a + w; i++) {
      if (i < 0 || i >= this.size || j < 0 || j >= this.size) throw new Error("Contaminant object exceeds canvas");
      this.cells[j * this.size + i] = c;
    }
  }
  rect(x, y, w, h, c) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.dot(i, j, c);
  }
  line(p, c) {
    for (let n = 1; n < p.length; n++) {
      let [x, y] = p[n - 1];
      const [bx, by] = p[n];
      const dx = Math.abs(bx - x), sx = x < bx ? 1 : -1, dy = -Math.abs(by - y), sy = y < by ? 1 : -1;
      let e = dx + dy;
      for (; ; ) {
        this.dot(x, y, c);
        if (x === bx && y === by) break;
        const ee = 2 * e;
        if (ee >= dy) {
          e += dy;
          x += sx;
        }
        if (ee <= dx) {
          e += dx;
          y += sy;
        }
      }
    }
  }
  poly(points2, c) {
    const p = points2.map(([x, y]) => [this.coord(x), this.coord(y)]);
    for (let y = 1; y < this.size - 1; y++) for (let x = 1; x < this.size - 1; x++) {
      let inside = false;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        const a = p[i], b = p[j];
        if (a[1] > y + 0.5 !== b[1] > y + 0.5 && x + 0.5 < (b[0] - a[0]) * (y + 0.5 - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
      }
      if (inside) this.cells[y * this.size + x] = c;
    }
  }
};
var DRAW = {
  // A locked mineral cleft: broad sheared base, one long splinter, cold internal seam.
  solidify: (p) => {
    p.poly([[4, 17], [7, 7], [11, 3], [14, 9], [18, 6], [21, 16], [16, 21], [7, 20]], "d");
    p.poly([[7, 16], [8, 8], [11, 4], [12, 15], [10, 19]], "l");
    p.poly([[13, 12], [17, 8], [18, 17], [14, 19]], "m");
    p.line([[11, 5], [12, 11], [10, 15], [12, 18]], "h");
    p.line([[14, 9], [13, 15], [15, 18]], "g");
    p.line([[5, 18], [9, 20], [16, 20]], "s");
    p.dot(14, 14, "b");
  },
  // Hollow grinding jaw: heavy stony outer curve with opposed tooth fragments.
  ruminate: (p) => {
    p.poly([[4, 7], [8, 3], [16, 4], [20, 8], [20, 17], [16, 21], [8, 20], [3, 15]], "d");
    p.poly([[5, 8], [8, 5], [14, 5], [18, 8], [16, 10], [9, 9], [6, 14], [8, 18], [5, 16]], "m");
    p.poly([[9, 11], [15, 9], [18, 12], [15, 17], [9, 17], [7, 14]], "s");
    p.poly([[8, 8], [10, 8], [11, 12], [9, 13]], "l");
    p.poly([[14, 7], [16, 8], [14, 12], [13, 11]], "l");
    p.poly([[10, 18], [10, 15], [12, 14], [13, 18]], "l");
    p.line([[17, 11], [17, 15], [14, 18]], "g");
    p.dot(15, 16, "b");
  },
  // Three pieces of a broken lamina, separated by real transparent air.
  scatter: (p) => {
    p.poly([[4, 6], [11, 3], [11, 10], [7, 13], [3, 10]], "m");
    p.poly([[14, 4], [20, 8], [18, 15], [13, 12]], "d");
    p.poly([[8, 15], [11, 12], [16, 16], [14, 21], [6, 20]], "m");
    p.line([[4, 6], [9, 4], [10, 8]], "l");
    p.line([[15, 5], [19, 8], [17, 10]], "l");
    p.line([[8, 16], [10, 14], [14, 17]], "h");
    p.line([[7, 11], [10, 9]], "g");
    p.line([[14, 19], [15, 17]], "g");
    p.dot(20, 18, "m");
    p.dot(3, 15, "d");
  },
  // A bent memory ribbon doubled back upon itself; an incomplete physical coil.
  retrograde: (p) => {
    p.line([[18, 6], [13, 3], [7, 5], [4, 10], [5, 16], [10, 20], [17, 18], [20, 13]], "d");
    p.line([[17, 7], [13, 5], [8, 7], [6, 11], [7, 15], [11, 18], [16, 16], [17, 12], [14, 9], [10, 10], [10, 13], [13, 14]], "m");
    p.line([[17, 6], [13, 4], [8, 6], [5, 11], [6, 15], [10, 19]], "l");
    p.line([[12, 18], [16, 16], [17, 12]], "g");
    p.line([[10, 11], [11, 13], [13, 13]], "b");
    p.rect(18, 12, 3, 2, "d");
    p.dot(13, 6, "s");
  },
  // Split time-amber, with a small suspended fragment caught between two shelves.
  delay: (p) => {
    p.poly([[5, 4], [18, 3], [20, 7], [15, 10], [8, 9], [4, 7]], "m");
    p.poly([[8, 15], [16, 15], [20, 20], [5, 21], [3, 18]], "d");
    p.poly([[7, 16], [15, 16], [18, 19], [5, 19]], "m");
    p.line([[5, 4], [17, 4], [19, 6]], "l");
    p.line([[5, 18], [9, 16], [15, 17]], "l");
    p.rect(10, 11, 3, 2, "g");
    p.dot(11, 10, "b");
    p.dot(11, 14, "t");
    p.line([[16, 7], [14, 9]], "g");
    p.dot(18, 18, "s");
  },
  // A siphoning root/hollow tube, with a bent intake and a knotted reservoir.
  siphon: (p) => {
    p.poly([[5, 3], [10, 3], [11, 8], [9, 12], [10, 16], [16, 17], [17, 13], [15, 10], [17, 7], [20, 8], [20, 16], [17, 21], [9, 20], [5, 16], [6, 10], [7, 7]], "d");
    p.line([[6, 4], [9, 4], [9, 8], [7, 12], [8, 17], [12, 19], [16, 19]], "l");
    p.line([[18, 9], [18, 15], [15, 17], [11, 17]], "g");
    p.rect(6, 4, 3, 2, "s");
    p.dot(18, 9, "b");
    p.line([[12, 19], [11, 21]], "m");
  },
  // Thin porous stone expanded around several large voids.
  expand: (p) => {
    p.poly([[8, 3], [16, 4], [20, 8], [20, 15], [16, 21], [7, 20], [3, 15], [4, 8]], "m");
    p.poly([[9, 6], [14, 6], [16, 9], [13, 12], [8, 10]], "s");
    p.poly([[9, 6], [14, 6], [14, 9], [10, 10]], "d");
    p.rect(10, 7, 3, 3);
    p.rect(6, 13, 4, 4);
    p.rect(14, 13, 4, 5);
    p.rect(17, 8, 3, 3);
    p.line([[8, 4], [13, 4], [15, 6]], "l");
    p.line([[4, 10], [4, 14], [6, 18]], "l");
    p.line([[11, 13], [12, 17], [11, 20]], "g");
    p.dot(12, 15, "b");
  },
  // Worn resonating fork, one tine broken short, a taut strand bridges its arms.
  resonate: (p) => {
    p.poly([[4, 4], [7, 3], [8, 12], [12, 14], [16, 11], [16, 4], [19, 5], [19, 13], [14, 18], [14, 22], [10, 22], [10, 18], [5, 15]], "d");
    p.line([[5, 5], [6, 12], [10, 16], [12, 17], [17, 12], [17, 5]], "l");
    p.line([[7, 8], [16, 8]], "t");
    p.line([[8, 9], [15, 9]], "g");
    p.dot(12, 9, "b");
    p.rect(11, 18, 2, 3, "m");
    p.dot(18, 6, "s");
  },
  // Several overwritten slate leaves with misregistered corners and incised seams.
  overwrite: (p) => {
    p.poly([[5, 4], [17, 3], [19, 15], [8, 18]], "d");
    p.poly([[3, 8], [14, 6], [18, 18], [6, 21]], "s");
    p.poly([[6, 6], [19, 6], [20, 18], [8, 20]], "m");
    p.line([[7, 6], [18, 6], [19, 12]], "l");
    p.line([[9, 9], [15, 9], [15, 12], [18, 12]], "s");
    p.line([[8, 14], [12, 14], [12, 17], [18, 17]], "t");
    p.line([[12, 14], [12, 17], [15, 17]], "g");
    p.dot(12, 15, "b");
    p.dot(17, 8, "d");
  },
  // Iron eaten from one edge, leaving a ragged porous comb.
  erode: (p) => {
    p.poly([[5, 4], [17, 4], [20, 7], [17, 10], [20, 12], [17, 15], [18, 18], [13, 21], [5, 18], [3, 10]], "m");
    p.poly([[4, 8], [8, 5], [9, 17], [6, 19], [4, 14]], "d");
    p.line([[6, 4], [16, 5], [18, 7]], "l");
    p.rect(12, 7, 3, 3, "s");
    p.rect(10, 13, 3, 3, "s");
    p.rect(16, 10, 5, 2);
    p.rect(15, 16, 5, 2);
    p.line([[15, 8], [15, 11], [13, 12], [14, 15]], "g");
    p.dot(12, 19, "t");
    p.dot(17, 13, "b");
  },
  // A dense, folded muffling felt, blunt edges and quiet nested folds.
  muffle: (p) => {
    p.poly([[5, 5], [15, 3], [20, 8], [19, 18], [10, 21], [4, 17], [3, 10]], "d");
    p.poly([[5, 8], [14, 5], [17, 8], [8, 12], [8, 18], [5, 15]], "m");
    p.poly([[9, 12], [18, 9], [17, 17], [10, 19]], "s");
    p.line([[5, 7], [13, 4], [17, 7]], "l");
    p.line([[9, 14], [15, 12], [15, 16], [11, 17]], "d");
    p.line([[5, 12], [6, 17], [9, 19]], "t");
    p.dot(8, 18, "g");
    p.dot(11, 6, "d");
  },
  // One self-consuming charred splinter; its ember is teal, never an ordinary flame.
  kindle: (p) => {
    p.poly([[10, 2], [14, 5], [13, 9], [17, 12], [16, 18], [12, 22], [7, 19], [6, 14], [9, 10]], "d");
    p.poly([[10, 5], [12, 6], [11, 12], [14, 14], [12, 19], [9, 19], [8, 15]], "m");
    p.line([[10, 5], [10, 10], [8, 14]], "l");
    p.line([[11, 11], [12, 14], [10, 17], [12, 19]], "g");
    p.dot(12, 15, "b");
    p.line([[14, 17], [14, 19], [12, 21]], "s");
    p.dot(18, 17, "d");
    p.dot(6, 21, "m");
  },
  // Two unlike ceramic scraps forcibly held together by exposed crossing threads.
  stitch: (p) => {
    p.poly([[4, 5], [10, 3], [11, 18], [6, 20], [3, 13]], "m");
    p.poly([[15, 5], [20, 8], [19, 19], [14, 21], [13, 11]], "d");
    p.line([[4, 7], [8, 4], [9, 8]], "l");
    p.line([[16, 6], [19, 8], [18, 14]], "l");
    for (const y of [8, 12, 16]) {
      p.dot(9, y, "s");
      p.dot(15, y + 1, "s");
      p.line([[9, y], [15, y + 1]], y === 12 ? "g" : "l");
    }
    p.line([[11, 7], [12, 19]], "t");
    p.dot(12, 13, "b");
  },
  // A squat, compressed lead weight, heavy stacked planes and an embedded loop.
  compress: (p) => {
    p.line([[9, 7], [9, 4], [11, 3], [14, 4], [15, 7]], "m");
    p.poly([[7, 8], [16, 7], [20, 16], [18, 20], [5, 21], [3, 17]], "d");
    p.poly([[7, 8], [16, 8], [18, 12], [5, 13]], "l");
    p.poly([[5, 14], [19, 13], [18, 17], [5, 18]], "m");
    p.line([[5, 19], [17, 18]], "s");
    p.line([[8, 11], [13, 11], [15, 12]], "h");
    p.line([[9, 14], [13, 14], [14, 17]], "g");
    p.dot(13, 15, "b");
  },
  // A jagged mirrored shard with a chipped backing and one broad reflected plane.
  mirror: (p) => {
    p.poly([[6, 6], [15, 2], [20, 8], [16, 12], [18, 17], [10, 22], [4, 17], [6, 13], [3, 10]], "d");
    p.poly([[7, 6], [14, 4], [17, 8], [14, 11], [15, 16], [10, 19], [7, 15]], "m");
    p.poly([[8, 7], [14, 5], [12, 10], [9, 13], [7, 12]], "h");
    p.line([[7, 14], [10, 17], [14, 14]], "l");
    p.line([[14, 7], [12, 12], [14, 14]], "t");
    p.dot(12, 11, "g");
    p.line([[5, 17], [10, 21], [16, 17]], "s");
  },
  // Fossil resonance shell: a large open mouth with diminishing mineral ribs.
  echo: (p) => {
    p.poly([[5, 7], [11, 3], [17, 5], [21, 11], [19, 18], [12, 21], [6, 18], [3, 12]], "d");
    p.poly([[6, 8], [11, 5], [16, 7], [18, 12], [16, 17], [11, 18], [7, 15]], "m");
    p.line([[5, 10], [6, 7], [11, 4], [17, 6], [20, 11]], "l");
    p.line([[8, 9], [11, 7], [15, 9], [16, 13], [13, 16], [10, 15]], "l");
    p.line([[10, 10], [13, 10], [14, 12], [12, 13]], "t");
    p.dot(13, 11, "b");
    p.poly([[4, 12], [7, 13], [9, 18], [6, 18]], "s");
    p.line([[17, 15], [16, 18], [12, 20]], "g");
  },
  // An irregular hollow nodule: the void is real transparent negative space.
  abyss: (p) => {
    p.poly([[8, 3], [16, 4], [20, 9], [21, 15], [16, 20], [9, 22], [3, 16], [4, 8]], "d");
    p.poly([[8, 5], [15, 5], [18, 9], [17, 15], [13, 19], [8, 18], [5, 13]], "m");
    p.poly([[10, 7], [14, 7], [17, 11], [15, 16], [11, 18], [7, 14], [8, 10]], "s");
    p.rect(10, 9, 4, 7);
    p.rect(8, 11, 8, 3);
    p.line([[9, 6], [15, 6], [18, 10]], "l");
    p.line([[7, 15], [10, 18], [14, 17]], "g");
    p.dot(14, 16, "b");
    p.dot(18, 17, "s");
  },
  // Collapsed ash cup with brittle radiating ribs and a submerged cold ember.
  combust: (p) => {
    p.poly([[3, 11], [7, 7], [9, 3], [12, 8], [18, 5], [18, 10], [22, 13], [18, 19], [9, 21], [4, 17]], "d");
    p.poly([[5, 13], [10, 9], [16, 10], [19, 14], [16, 18], [10, 19]], "m");
    p.poly([[8, 12], [13, 10], [17, 13], [15, 17], [10, 17]], "s");
    p.line([[5, 12], [9, 9], [8, 5]], "l");
    p.line([[13, 9], [17, 7], [16, 11]], "m");
    p.line([[6, 16], [10, 19], [16, 18], [19, 14]], "l");
    p.line([[10, 14], [12, 12], [15, 13], [13, 16]], "g");
    p.dot(12, 14, "b");
    p.dot(20, 20, "m");
    p.dot(4, 20, "d");
  }
};
var SAMPLE_DRAW = {
  solidify(p, q) {
    p.poly([[5, 8], [9, 5], [15, 6], [18, 9], [17, 17], [13, 20], [5, 18], [3, 14]], "d");
    p.poly([[5, 8], [9, 6], [15, 7], [17, 10], [12, 12], [4, 11]], "l");
    p.poly([[4, 12], [12, 13], [13, 19], [6, 17]], "m");
    p.line([[13, 13], [17, 11], [16, 16], [13, 19]], "s");
    p.line([[6, 9], [9, 8], [13, 9]], "h");
    p.dot(7, 14, "d");
    p.dot(9, 17, "l");
    p.dot(15, 15, "m");
    p.line([[7, 12], [10, 13], [10, 15]], "t");
    p.dot(10, 13, "g");
    if (q >= 1) {
      p.rect(4, 12, 13, 1);
      p.line([[5, 13], [10, 14], [12, 13]], "g");
      p.poly([[18, 12], [20, 11], [21, 15], [18, 17]], "m");
    }
    if (q >= 2) {
      p.poly([[7, 3], [13, 3], [16, 5], [11, 7], [6, 6]], "m");
      p.line([[7, 3], [12, 3], [14, 4]], "h");
      p.rect(5, 16, 8, 1);
      p.line([[6, 17], [10, 18]], "g");
    }
    if (q >= 3) {
      p.poly([[15, 3], [18, 4], [19, 7], [17, 8], [15, 6]], "l");
      p.line([[17, 5], [18, 6]], "g");
      p.rect(9, 10, 1, 2);
      p.dot(9, 12, "b");
      p.poly([[3, 18], [7, 20], [6, 22], [3, 20]], "m");
    }
  },
  scatter(p, q) {
    const shift = q >= 2 ? 2 : 1;
    p.poly([[6 + shift, 5], [17 + shift, 6], [20, 13], [15 + shift, 19], [6 + shift, 17]], "s");
    if (q >= 1) p.line([[9, 4], [18, 5], [20, 12], [18, 17]], "t");
    if (q >= 2) p.line([[10, 2], [20, 4], [21, 11]], "g");
    p.poly([[4, 7], [13, 4], [17, 8], [16, 17], [9, 20], [4, 16]], "d");
    p.poly([[5, 7], [12, 5], [15, 8], [10, 12], [5, 12]], "l");
    p.poly([[5, 13], [10, 13], [15, 10], [14, 16], [9, 18], [5, 16]], "m");
    p.line([[5, 8], [11, 6], [14, 8]], "h");
    p.line([[7, 14], [11, 15], [14, 13]], "s");
    p.line([[6, 10], [9, 9]], "m");
    p.dot(7, 16, "l");
    p.line([[15, 10], [15, 16], [10, 19]], "g");
    if (q >= 1) {
      p.line([[17, 10], [17, 17], [12, 20]], "m");
      p.dot(13, 19, "b");
    }
    if (q >= 3) {
      p.line([[2, 8], [2, 16], [7, 21], [12, 21]], "m");
      p.line([[19, 13], [19, 18], [15, 21]], "g");
      p.rect(6, 11, 8, 1);
    }
  },
  retrograde(p, q) {
    p.poly([[9, 3], [15, 4], [18, 8], [14, 20], [8, 22], [5, 17]], "s");
    p.poly([[9, 3], [14, 4], [16, 8], [12, 19], [8, 20], [6, 17]], "m");
    p.line([[9, 4], [7, 12], [7, 17], [9, 19]], "l");
    p.line([[10, 5], [13, 6], [14, 8]], "h");
    p.poly([[10, 8], [12, 7], [13, 9], [11, 12], [9, 11]], "d");
    p.rect(9, 13, 2, 3, "s");
    p.dot(11, 13, "t");
    p.dot(9, 16, "g");
    if (q >= 1) {
      p.poly([[13, 13], [15, 12], [15, 15], [13, 18], [12, 17]], "t");
      p.line([[14, 13], [13, 15]], "g");
    }
    if (q >= 2) {
      p.poly([[17, 4], [19, 5], [20, 8], [17, 12], [15, 12], [17, 8]], "d");
      p.line([[17, 5], [18, 7], [16, 10]], "l");
      p.line([[8, 18], [11, 18]], "g");
    }
    if (q >= 3) {
      p.line([[5, 10], [4, 15], [5, 19], [7, 21]], "m");
      p.rect(8, 11, 7, 1);
      p.line([[9, 12], [11, 13], [13, 12]], "g");
      p.dot(13, 8, "b");
    }
  },
  muffle(p, q) {
    p.poly([[5, 6], [14, 4], [19, 9], [17, 17], [20, 20], [12, 21], [7, 19], [3, 20], [5, 13]], "d");
    p.poly([[5, 7], [13, 5], [17, 8], [10, 11], [7, 16], [4, 18]], "m");
    p.line([[6, 7], [12, 5], [16, 7]], "l");
    p.poly([[10, 12], [18, 9], [16, 16], [13, 18], [8, 18]], "s");
    p.line([[7, 12], [7, 17], [11, 20], [16, 19]], "m");
    p.line([[10, 13], [14, 12], [13, 15]], "d");
    p.line([[6, 9], [8, 8]], "d");
    p.dot(9, 7, "m");
    p.dot(10, 6, "d");
    p.line([[5, 15], [6, 13]], "l");
    p.line([[5, 16], [4, 20]], "l");
    p.dot(7, 21, "d");
    p.dot(17, 21, "m");
    if (q >= 1) {
      p.line([[10, 14], [13, 13], [15, 14], [13, 17], [10, 18]], "t");
      p.dot(12, 17, "g");
    }
    if (q >= 2) {
      p.poly([[16, 4], [20, 6], [21, 11], [19, 14], [18, 12], [19, 8]], "m");
      p.line([[18, 6], [20, 9], [19, 11]], "l");
      p.line([[9, 15], [10, 17], [12, 18]], "g");
    }
    if (q >= 3) {
      p.poly([[3, 8], [4, 4], [8, 3], [7, 6], [5, 8]], "d");
      p.line([[4, 5], [7, 4]], "l");
      p.line([[11, 11], [15, 10], [16, 12], [14, 16]], "g");
      p.dot(14, 11, "b");
    }
  },
  expand(p, q) {
    p.poly([[7, 4], [14, 3], [19, 7], [21, 13], [18, 19], [10, 21], [4, 17], [3, 10]], "d");
    p.poly([[7, 5], [14, 4], [18, 7], [15, 10], [9, 10], [5, 13], [4, 10]], "l");
    p.poly([[5, 14], [9, 16], [15, 16], [19, 13], [17, 18], [10, 19], [5, 16]], "m");
    p.rect(3, 11, 13, 3);
    p.rect(3, 14, 7, 1);
    p.line([[9, 10], [14, 9], [18, 10], [18, 14], [15, 16]], "s");
    p.line([[10, 15], [15, 15], [16, 13]], "t");
    p.dot(15, 14, "g");
    if (q >= 1) {
      p.rect(3, 10, 8, 1);
      p.line([[5, 9], [8, 8]], "h");
      p.line([[10, 16], [14, 17], [17, 15]], "g");
    }
    if (q >= 2) {
      p.rect(16, 11, 2, 3);
      p.line([[19, 9], [20, 12], [18, 16]], "l");
      p.poly([[4, 18], [7, 20], [7, 22], [3, 20]], "m");
    }
    if (q >= 3) {
      p.rect(9, 4, 1, 5);
      p.poly([[7, 2], [10, 2], [10, 3], [6, 4]], "m");
      p.line([[11, 5], [13, 5]], "h");
      p.dot(16, 15, "b");
      p.line([[7, 16], [8, 18]], "g");
    }
  },
  mirror(p, q) {
    p.poly([[5, 8], [13, 3], [18, 5], [17, 10], [20, 15], [12, 21], [6, 18], [7, 13]], "s");
    p.poly([[6, 8], [13, 4], [16, 6], [15, 11], [18, 15], [12, 19], [8, 17], [9, 12]], "d");
    p.poly([[7, 8], [12, 5], [14, 6], [11, 11], [8, 12]], "l");
    p.line([[8, 8], [12, 6]], "h");
    p.line([[8, 10], [13, 7]], "m");
    p.line([[13, 5], [15, 6], [14, 10]], "l");
    p.poly([[11, 12], [14, 10], [16, 14], [13, 17], [10, 16]], "m");
    p.line([[10, 14], [12, 12], [13, 13], [13, 16]], "t");
    p.line([[11, 16], [14, 14]], "l");
    p.dot(13, 15, "h");
    if (q >= 1) {
      p.line([[12, 9], [14, 8], [15, 10], [14, 13]], "g");
      p.line([[8, 17], [11, 19], [14, 17]], "l");
    }
    if (q >= 2) {
      p.poly([[17, 3], [20, 5], [21, 11], [19, 13], [18, 10], [19, 6]], "m");
      p.line([[19, 5], [20, 8]], "l");
      p.line([[12, 13], [14, 12], [15, 15]], "g");
    }
    if (q >= 3) {
      p.line([[3, 8], [4, 14], [3, 16], [8, 20]], "m");
      p.line([[5, 8], [6, 12]], "g");
      p.rect(8, 10, 8, 1);
      p.dot(14, 14, "b");
      p.line([[11, 18], [14, 19], [16, 17]], "t");
    }
  },
  kindle(p, q) {
    p.poly([[3, 12], [7, 8], [12, 5], [17, 4], [21, 8], [21, 12], [18, 15], [14, 18], [8, 21], [3, 19]], "d");
    p.poly([[8, 9], [12, 6], [17, 5], [19, 8], [16, 12], [10, 15], [5, 17], [4, 14]], "m");
    p.line([[8, 9], [12, 6], [17, 5], [19, 7]], "l");
    p.poly([[3, 13], [7, 11], [11, 12], [12, 15], [9, 19], [4, 20], [3, 18]], "s");
    p.poly([[4, 14], [7, 13], [9, 14], [9, 17], [6, 19], [4, 18]], "d");
    p.line([[3, 12], [6, 11], [9, 11], [11, 13], [11, 16], [8, 20], [4, 20]], "l");
    p.line([[5, 12], [7, 12]], "h");
    p.line([[12, 8], [15, 8], [17, 10], [16, 13]], "d");
    p.line([[12, 9], [14, 9], [15, 11]], "l");
    p.line([[17, 7], [19, 9], [18, 12]], "l");
    p.line([[6, 16], [8, 15], [8, 17]], "t");
    if (q >= 1) {
      p.line([[6, 14], [8, 14], [9, 16], [7, 18]], "g");
      p.line([[13, 14], [16, 12], [18, 13]], "m");
    }
    if (q >= 2) {
      p.poly([[18, 2], [21, 4], [22, 8], [20, 10], [20, 6], [17, 4]], "d");
      p.line([[19, 3], [21, 6]], "l");
      p.line([[12, 16], [15, 15], [17, 12]], "g");
    }
    if (q >= 3) {
      p.poly([[2, 10], [5, 8], [9, 7], [8, 9], [4, 11], [2, 14]], "m");
      p.line([[3, 10], [6, 8]], "l");
      p.line([[5, 15], [7, 14], [9, 15], [8, 18], [6, 19]], "g");
      p.dot(7, 16, "b");
      p.rect(13, 9, 1, 3);
    }
  },
  combust(p, q) {
    p.poly([[4, 10], [9, 5], [15, 6], [19, 10], [18, 17], [14, 20], [6, 19], [3, 15]], "s");
    p.poly([[5, 10], [9, 6], [14, 7], [16, 10], [12, 12], [7, 12]], "m");
    p.poly([[5, 13], [11, 12], [16, 10], [17, 15], [13, 18], [7, 17]], "d");
    p.line([[6, 9], [9, 6], [13, 7]], "l");
    p.line([[6, 14], [8, 17], [12, 18]], "m");
    p.dot(8, 8, "d");
    p.dot(11, 9, "d");
    p.dot(15, 13, "m");
    p.line([[8, 11], [10, 12], [10, 15], [13, 17]], "s");
    p.line([[10, 13], [13, 12], [15, 10]], "t");
    p.line([[10, 13], [10, 15], [12, 16]], "g");
    if (q >= 1) {
      p.poly([[15, 5], [18, 6], [20, 10], [18, 12], [17, 8]], "d");
      p.line([[17, 6], [19, 9]], "m");
      p.line([[9, 12], [10, 13], [13, 12]], "g");
      p.rect(8, 18, 5, 1);
    }
    if (q >= 2) {
      p.poly([[4, 7], [7, 4], [11, 3], [12, 5], [8, 6], [6, 10]], "d");
      p.line([[5, 7], [8, 4], [10, 4]], "l");
      p.line([[11, 12], [12, 14], [15, 15]], "g");
      p.dot(11, 13, "b");
    }
    if (q >= 3) {
      p.poly([[18, 14], [21, 13], [21, 17], [18, 21], [13, 22], [16, 19]], "d");
      p.line([[20, 15], [19, 18], [17, 20]], "l");
      p.line([[8, 10], [10, 11], [13, 10], [15, 11]], "g");
      p.rect(4, 12, 4, 1);
    }
  },
  delay(p, q) {
    p.poly([[8, 3], [12, 2], [15, 4], [14, 7], [17, 11], [16, 15], [12, 16], [7, 14], [5, 10], [8, 6]], "d");
    p.poly([[8, 4], [11, 3], [12, 6], [9, 9], [8, 13], [6, 10]], "m");
    p.poly([[11, 8], [14, 7], [16, 11], [14, 13], [10, 13]], "m");
    p.line([[8, 4], [10, 3], [13, 4]], "l");
    p.line([[7, 9], [8, 7]], "l");
    p.line([[10, 7], [13, 6]], "s");
    p.poly([[8, 12], [12, 13], [15, 11], [14, 15], [11, 14], [9, 16], [7, 14]], "s");
    p.line([[8, 13], [10, 14]], "l");
    p.dot(14, 13, "l");
    p.dot(10, 17, "m");
    p.dot(13, 19, "l");
    p.dot(8, 20, "d");
    p.rect(10, 21, 2, 1, "m");
    p.dot(11, 16, "t");
    if (q >= 1) {
      p.rect(11, 12, 1, 3);
      p.line([[15, 9], [16, 11], [15, 14]], "t");
      p.dot(10, 17, "g");
      p.dot(15, 18, "m");
      p.dot(11, 19, "l");
    }
    if (q >= 2) {
      p.poly([[17, 8], [19, 10], [18, 14], [16, 16], [17, 12]], "d");
      p.line([[18, 10], [18, 12]], "l");
      p.dot(7, 17, "l");
      p.dot(14, 21, "g");
      p.line([[11, 4], [12, 5]], "h");
    }
    if (q >= 3) {
      p.line([[5, 7], [4, 10], [6, 13]], "m");
      p.rect(7, 10, 2, 1);
      p.dot(12, 18, "b");
      p.dot(17, 20, "m");
      p.dot(8, 18, "g");
      p.rect(13, 8, 1, 2);
      p.line([[14, 7], [16, 8]], "l");
    }
  },
  siphon(p, q) {
    p.poly([[11, 3], [16, 4], [20, 8], [21, 14], [18, 19], [12, 21], [8, 19], [7, 16], [10, 17], [14, 16], [15, 12], [13, 8], [8, 7]], "d");
    p.poly([[11, 4], [15, 5], [18, 8], [18, 13], [15, 18], [11, 19], [9, 17], [13, 17], [15, 13], [13, 8], [9, 6]], "m");
    p.line([[11, 4], [14, 5], [17, 8]], "l");
    p.line([[16, 7], [18, 10], [18, 13], [16, 16]], "l");
    p.line([[16, 11], [19, 11]], "s");
    p.line([[15, 15], [18, 16]], "s");
    p.line([[13, 8], [14, 11], [13, 15]], "s");
    p.poly([[7, 7], [11, 6], [13, 8], [11, 9], [8, 9], [5, 12], [4, 10]], "m");
    p.line([[7, 7], [10, 7]], "l");
    p.line([[12, 17], [9, 16], [6, 17], [5, 19]], "m");
    p.line([[12, 15], [11, 16], [8, 15]], "t");
    p.dot(11, 16, "g");
    if (q >= 1) {
      p.line([[8, 10], [7, 12], [8, 14], [11, 14]], "d");
      p.line([[9, 10], [8, 12], [10, 13]], "g");
      p.line([[5, 18], [7, 18]], "l");
    }
    if (q >= 2) {
      p.poly([[18, 3], [21, 6], [22, 10], [20, 10], [19, 6], [16, 4]], "d");
      p.line([[19, 4], [21, 7]], "m");
      p.rect(16, 13, 3, 1);
      p.line([[16, 14], [18, 15]], "g");
    }
    if (q >= 3) {
      p.poly([[10, 2], [13, 2], [14, 3], [10, 4], [7, 6], [5, 6]], "m");
      p.line([[7, 5], [9, 3]], "l");
      p.line([[6, 12], [6, 14], [8, 15]], "l");
      p.rect(12, 18, 3, 1);
      p.dot(10, 13, "b");
    }
  },
  stitch(p, q) {
    p.poly([[7, 3], [11, 4], [15, 9], [16, 14], [13, 18], [8, 17], [5, 13], [6, 9], [8, 7], [5, 5]], "d");
    p.line([[7, 4], [10, 5], [13, 9], [14, 13], [12, 16], [9, 15], [7, 12], [8, 9], [10, 8]], "m");
    p.line([[7, 4], [10, 5], [12, 8]], "l");
    p.line([[6, 9], [5, 12], [8, 16], [12, 18], [15, 15], [15, 11], [12, 8]], "m");
    p.line([[6, 10], [6, 12], [8, 15], [10, 16]], "l");
    p.line([[10, 9], [8, 11], [9, 13], [12, 14], [14, 12]], "s");
    p.line([[10, 10], [9, 11], [10, 13], [12, 13]], "l");
    p.dot(10, 11, "h");
    p.line([[12, 14], [15, 17], [17, 21]], "d");
    p.line([[12, 15], [14, 17], [16, 21]], "m");
    p.line([[14, 18], [15, 20]], "l");
    p.line([[8, 16], [8, 17], [10, 18]], "m");
    p.line([[8, 17], [9, 18]], "l");
    p.line([[11, 15], [12, 16]], "t");
    if (q >= 1) {
      p.line([[13, 9], [16, 9], [18, 12], [17, 15], [14, 16]], "d");
      p.line([[15, 10], [17, 12], [16, 14]], "m");
      p.line([[10, 15], [12, 16], [14, 14]], "g");
      p.rect(12, 8, 1, 1);
    }
    if (q >= 2) {
      p.line([[4, 8], [3, 11], [4, 14], [6, 16]], "m");
      p.line([[4, 9], [4, 12], [5, 14]], "l");
      p.rect(7, 15, 1, 1);
      p.line([[7, 16], [8, 17]], "g");
    }
    if (q >= 3) {
      p.line([[13, 3], [15, 5], [15, 7]], "d");
      p.line([[13, 4], [14, 5], [14, 6]], "l");
      p.rect(14, 11, 2, 1);
      p.line([[15, 12], [14, 14]], "g");
      p.dot(12, 13, "b");
      p.line([[18, 15], [19, 18], [20, 19]], "m");
    }
  },
  compress(p, q) {
    p.poly([[7, 5], [12, 3], [17, 6], [18, 12], [16, 19], [12, 22], [7, 19], [5, 13], [4, 8]], "s");
    p.poly([[7, 5], [12, 4], [16, 6], [15, 9], [9, 10], [5, 8]], "m");
    p.poly([[5, 9], [9, 11], [15, 10], [16, 15], [13, 20], [9, 18], [7, 14]], "d");
    p.poly([[6, 10], [9, 11], [10, 17], [8, 17], [6, 13]], "m");
    p.line([[7, 5], [11, 4], [14, 5]], "l");
    p.line([[7, 7], [10, 6], [12, 7]], "h");
    p.line([[14, 10], [14, 14], [12, 18], [12, 21]], "s");
    p.line([[10, 12], [11, 15], [11, 19]], "t");
    p.dot(11, 16, "g");
    p.dot(8, 12, "d");
    p.dot(14, 12, "m");
    if (q >= 1) {
      p.line([[15, 13], [14, 18], [13, 21]], "m");
      p.rect(10, 19, 1, 2);
      p.line([[11, 14], [12, 17], [12, 20]], "g");
    }
    if (q >= 2) {
      p.poly([[3, 11], [5, 12], [7, 17], [6, 20], [4, 18]], "d");
      p.line([[4, 13], [5, 16], [5, 18]], "l");
      p.rect(8, 9, 3, 1);
      p.line([[11, 10], [13, 10]], "g");
    }
    if (q >= 3) {
      p.poly([[18, 10], [20, 12], [19, 16], [17, 20], [16, 21], [17, 16]], "d");
      p.line([[19, 12], [18, 16], [17, 18]], "m");
      p.rect(12, 6, 1, 2);
      p.dot(12, 18, "b");
      p.line([[14, 17], [14, 20]], "g");
    }
  },
  abyss(p, q) {
    p.poly([[10, 4], [16, 4], [20, 8], [21, 14], [17, 19], [11, 20], [8, 17], [14, 17], [17, 13], [17, 9], [13, 6], [8, 7]], "s");
    p.line([[12, 4], [16, 5], [19, 8], [20, 12]], "d");
    p.poly([[6, 8], [10, 6], [14, 8], [16, 12], [14, 16], [10, 18], [6, 16], [4, 12]], "d");
    p.poly([[6, 8], [10, 7], [13, 9], [13, 12], [10, 13], [6, 12]], "m");
    p.line([[6, 9], [8, 7], [11, 8]], "l");
    p.dot(8, 8, "h");
    p.poly([[12, 10], [16, 11], [15, 15], [11, 17], [8, 16], [12, 14]], "s");
    p.line([[14, 8], [15, 10], [15, 12]], "t");
    p.line([[6, 14], [8, 16], [10, 17]], "m");
    if (q >= 1) {
      p.line([[17, 7], [18, 10], [18, 13], [16, 16]], "t");
      p.line([[17, 11], [17, 14]], "g");
      p.rect(10, 16, 2, 1);
    }
    if (q >= 2) {
      p.poly([[7, 4], [11, 3], [15, 3], [17, 4], [13, 5], [9, 5], [6, 7]], "d");
      p.line([[9, 4], [13, 4]], "m");
      p.rect(18, 12, 3, 1);
      p.line([[18, 14], [16, 17]], "m");
    }
    if (q >= 3) {
      p.poly([[3, 15], [6, 18], [10, 20], [8, 22], [4, 20], [2, 17]], "d");
      p.line([[4, 17], [6, 19], [8, 20]], "m");
      p.rect(13, 5, 1, 3);
      p.line([[13, 8], [14, 10]], "g");
      p.dot(14, 11, "b");
    }
  }
};
var pixelsCache = /* @__PURE__ */ new Map();
function grid(type, quality = "ordinary", size = 24) {
  const key = `${type}:${quality}:${size}`;
  let p = pixelsCache.get(key);
  if (!p) {
    p = new Pixels(size);
    const sample = SAMPLE_DRAW[type];
    if (sample) sample(p, CONTAMINANT_ART_QUALITIES.indexOf(quality));
    else DRAW[type](p);
    pixelsCache.set(key, p);
  }
  return p;
}
function rgba(p) {
  const data = new Uint8ClampedArray(p.size * p.size * 4);
  p.cells.forEach((ink, index) => {
    if (!ink) return;
    const rgb = Number.parseInt(PALETTE[ink].slice(1), 16);
    data[index * 4] = rgb >> 16;
    data[index * 4 + 1] = rgb >> 8 & 255;
    data[index * 4 + 2] = rgb & 255;
    data[index * 4 + 3] = 255;
  });
  return data;
}
function contaminantWorldPixels(type, quality = "ordinary") {
  return { width: 32, height: 32, data: rgba(grid(type, quality, 32)) };
}

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/art/contaminant-catalog-icons-pixels.ts
var MAT = {
  iron: [3423812, 6583932, 10202031, 13686476],
  brass: [6177325, 10187068, 13280616, 15716240],
  amber: [6830883, 11037490, 14393676, 15913866],
  glass: [3230552, 5603208, 8829623, 13754574],
  bone: [5986128, 10262138, 13092002, 14933953],
  cloth: [3423811, 6450541, 9410704, 12106666],
  leather: [4337452, 7753802, 10909017, 13146997],
  wood: [4602668, 8152133, 11373920, 13744256],
  ceramic: [3689291, 5864818, 9612691, 13816240],
  paper: [6708039, 10391664, 13352345, 15128759],
  wax: [6641217, 10785382, 13417095, 15325607],
  plum: [4405060, 7493218, 10978949, 13678248],
  ink: 2503735,
  seam: 5406579
};

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/art/contaminant-catalog-icons-objects.ts
var CATALOG_OBJECTS = {
  amber_beetle(p) {
    const big = p.size === 32, b = MAT.amber;
    p.poly(big ? [[7, 7], [19, 4], [27, 11], [25, 23], [14, 28], [4, 19]] : [[5, 5], [14, 3], [20, 8], [19, 17], [10, 21], [3, 14]], b[1]);
    p.poly(big ? [[7, 7], [19, 4], [24, 10], [15, 13], [5, 16]] : [[5, 5], [14, 3], [18, 7], [11, 10], [4, 12]], b[2]);
    p.poly(big ? [[25, 11], [25, 22], [14, 27], [16, 20]] : [[19, 8], [18, 17], [10, 20], [12, 15]], b[0]);
    p.line(big ? [[7, 8], [12, 6], [18, 6]] : [[5, 6], [9, 4], [13, 4]], b[3]);
    const x = big ? 12 : 9, y = big ? 12 : 9, w = big ? 8 : 6, h = big ? 10 : 8;
    p.ellipse(x, y, w, h, MAT.iron[0]);
    p.ellipse(x + 2, y - 3, w - 3, 4, MAT.ink);
    p.line([[x - 2, y + 1], [x, y + 3], [x - 2, y + 6]], MAT.ink);
    p.line([[x + w + 1, y], [x + w - 1, y + 3], [x + w, y + 7]], MAT.ink);
    p.line([[x + 2, y + 1], [x + 2, y + h - 2]], MAT.iron[1]);
    p.line([[x + 4, y + 2], [x + 4, y + h - 3]], b[0]);
    p.line(big ? [[22, 6], [21, 9], [23, 11], [22, 14]] : [[17, 5], [16, 7], [17, 9]], b[3]);
    p.protect(x - 1, y - 3, w + 2, h + 3);
    p.anchor = big ? [14, 26] : [10, 19];
  },
  stopped_pocket_watch(p) {
    const b = p.size === 32, m = MAT.brass, cx = b ? 13 : 10, cy = b ? 17 : 13, r = b ? 18 : 14;
    p.ellipse(b ? 8 : 7, 2, b ? 9 : 7, b ? 8 : 6, m[1]);
    p.ellipse(b ? 10 : 9, 3, b ? 5 : 3, b ? 4 : 3);
    p.rect(cx - 2, b ? 8 : 6, 4, 3, m[2]);
    p.ellipse(b ? 19 : 15, b ? 11 : 8, b ? 10 : 7, b ? 16 : 12, m[0]);
    p.ellipse(b ? 20 : 16, b ? 12 : 9, b ? 7 : 5, b ? 12 : 9, m[1]);
    p.line(b ? [[23, 13], [26, 15], [26, 22]] : [[18, 10], [20, 12], [20, 16]], m[2]);
    p.ellipse(cx - Math.floor(r / 2), cy - Math.floor(r / 2), r, r, m[1]);
    p.ellipse(cx - Math.floor(r / 2) + 1, cy - Math.floor(r / 2) + 1, r - 3, r - 3, MAT.paper[2]);
    p.ellipse(cx - Math.floor(r / 2) + 3, cy - Math.floor(r / 2) + 3, r - 6, r - 6, MAT.paper[1]);
    p.line([[cx, cy - 5], [cx, cy], [cx + 4, cy - 2]], MAT.iron[0]);
    p.rect(cx + 1, cy - 3, 2, 2, MAT.paper[3]);
    for (const [x, y] of b ? [[7, 17], [13, 11], [18, 17], [13, 23]] : [[5, 13], [10, 9], [14, 13], [10, 17]]) p.dot(x, y, m[0]);
    p.line(b ? [[6, 11], [9, 9], [13, 9]] : [[5, 9], [7, 7], [10, 7]], m[3]);
    p.protect(cx - 5, cy - 5, 11, 10);
    p.anchor = b ? [13, 25] : [10, 19];
  },
  sealed_hourglass(p) {
    const b = p.size === 32, g = MAT.glass, m = MAT.wood;
    const l = b ? 6 : 5, r = b ? 25 : 19, t = b ? 5 : 4, bt = b ? 27 : 21, c = b ? 16 : 12;
    p.rect(l, t, r - l, 3, m[1]);
    p.rect(l, bt - 3, r - l, 3, m[0]);
    p.rect(l + 1, t + 3, 2, bt - t - 6, m[1]);
    p.rect(r - 3, t + 3, 2, bt - t - 6, m[0]);
    p.poly([[l + 4, t + 3], [r - 4, t + 3], [c + 1, b ? 15 : 11], [r - 4, bt - 4], [l + 4, bt - 4], [c - 1, b ? 15 : 11]], g[1]);
    p.poly([[l + 5, t + 4], [r - 5, t + 4], [c, b ? 13 : 10]], MAT.paper[2]);
    p.line([[c, b ? 12 : 10], [c, b ? 19 : 14]], MAT.paper[2]);
    p.poly([[c - 2, bt - 8], [r - 4, bt - 4], [l + 4, bt - 4]], MAT.wax[2]);
    p.rect(l + 3, bt - 6, r - l - 6, 3, MAT.wax[1]);
    p.line([[l + 3, bt - 6], [c - 1, bt - 7], [r - 5, bt - 6]], MAT.wax[3]);
    p.line([[l, t], [r - 1, t]], m[3]);
    p.line([[l + 4, t + 4], [l + 5, t + 6], [c - 2, b ? 14 : 11]], g[3]);
    p.protect(c - 3, t + 4, 6, bt - t - 8);
    p.anchor = [c, bt - 2];
  },
  brass_monocle(p) {
    const b = p.size === 32, m = MAT.brass, g = MAT.glass, x = b ? 5 : 4, y = b ? 5 : 4, w = b ? 20 : 14, h = b ? 18 : 14;
    p.line(b ? [[23, 19], [25, 23], [24, 27]] : [[16, 16], [19, 18], [18, 21]], m[1], 2);
    p.ellipse(x, y, w, h, m[1]);
    p.ellipse(x + 2, y + 2, w - 4, h - 4, g[0]);
    p.poly(b ? [[10, 8], [18, 7], [20, 11], [12, 18], [8, 15]] : [[7, 6], [12, 6], [14, 9], [8, 14], [6, 11]], g[1]);
    p.line(b ? [[8, 12], [13, 8], [18, 8]] : [[6, 10], [9, 6], [12, 6]], g[3]);
    p.line(b ? [[9, 17], [15, 12], [19, 12]] : [[8, 13], [12, 10], [14, 10]], g[2]);
    p.rect(x + w - 3, y + 4, 3, 3);
    p.line([[x + 2, y + 2], [x + 6, y]], m[3]);
    p.protect(x + 2, y + 2, w - 4, h - 4);
    p.anchor = b ? [22, 22] : [17, 17];
  },
  milky_fish_eye(p) {
    const b = p.size === 32, o = MAT.bone, g = MAT.glass;
    p.poly(b ? [[3, 14], [8, 7], [16, 5], [26, 9], [29, 16], [24, 23], [14, 27], [5, 22]] : [[2, 11], [6, 5], [12, 4], [19, 7], [22, 12], [18, 18], [10, 20], [3, 17]], o[1]);
    p.poly(b ? [[5, 14], [10, 9], [17, 8], [25, 12], [25, 18], [17, 22], [8, 20]] : [[4, 11], [8, 7], [13, 6], [19, 9], [19, 14], [13, 17], [6, 16]], o[2]);
    p.poly(b ? [[5, 17], [11, 22], [18, 23], [24, 20], [22, 24], [14, 26], [7, 22]] : [[4, 14], [9, 18], [14, 18], [19, 15], [17, 18], [10, 20], [5, 17]], o[0]);
    const x = b ? 16 : 12, y = b ? 10 : 8, w = b ? 10 : 7, h = b ? 12 : 9;
    p.ellipse(x, y, w, h, g[0]);
    p.ellipse(x + 2, y + 2, w - 4, h - 3, MAT.ink);
    p.line(b ? [[18, 10], [22, 10], [24, 12]] : [[13, 8], [16, 8], [18, 10]], g[2]);
    p.rect(x + 2, y + 2, 2, 2, o[3]);
    p.line(b ? [[6, 13], [10, 9], [14, 8]] : [[4, 11], [8, 7], [10, 7]], o[3]);
    p.protect(x, y, w, h);
    p.anchor = b ? [14, 25] : [10, 18];
  },
  doorless_lantern(p) {
    const b = p.size === 32, m = MAT.iron;
    const l = b ? 8 : 6, r = b ? 24 : 19, t = b ? 11 : 8, bt = b ? 28 : 21;
    p.line(b ? [[11, 10], [10, 6], [12, 3], [19, 3], [21, 6], [20, 10]] : [[9, 8], [8, 5], [10, 2], [15, 2], [17, 5], [16, 8]], m[1], 2);
    p.poly([[l, t], [l + 3, t - 4], [r - 4, t - 4], [r, t], [r, bt], [l, bt]], m[1]);
    p.poly([[l + 2, t + 2], [r - 5, t + 2], [r - 5, bt - 3], [l + 2, bt - 3]], MAT.ink);
    p.poly([[r - 4, t], [r, t + 1], [r, bt - 1], [r - 4, bt - 3]], m[0]);
    p.line([[l, t], [r - 4, t]], m[3]);
    p.line([[l, t + 2], [l, bt - 2], [r - 3, bt - 2]], m[2]);
    p.rect(l + 5, bt - 8, 3, 5, MAT.wood[1]);
    p.rect(l + 4, bt - 4, 5, 2, m[1]);
    p.dot(l + 6, bt - 9, m[2]);
    p.line([[r - 2, t + 4], [r - 2, t + 8]], m[2]);
    p.protect(l + 2, t + 2, r - l - 6, bt - t - 5);
    p.anchor = [l + 6, bt - 2];
  },
  wax_sealed_button(p) {
    const b = p.size === 32, w = MAT.wax, m = MAT.bone;
    p.poly(b ? [[6, 8], [17, 5], [25, 9], [26, 19], [18, 27], [7, 24], [3, 15]] : [[5, 6], [13, 4], [19, 7], [20, 14], [14, 20], [6, 18], [3, 11]], w[1]);
    p.poly(b ? [[5, 10], [10, 7], [17, 7], [13, 12], [7, 17]] : [[4, 8], [8, 6], [12, 5], [10, 9], [5, 13]], w[2]);
    const x = b ? 10 : 8, y = b ? 10 : 8, s = b ? 14 : 10;
    p.ellipse(x, y, s, s, m[0]);
    p.ellipse(x + 1, y + 1, s - 2, s - 3, m[2]);
    for (const dx of [3, b ? 8 : 6]) for (const dy of [3, b ? 8 : 6]) p.rect(x + dx, y + dy, 2, 2);
    p.line([[x + 2, y + 2], [x + 6, y + 1]], m[3]);
    p.protect(x + 2, y + 2, s - 4, s - 4);
    p.anchor = b ? [15, 24] : [12, 18];
  },
  double_hole_token(p) {
    const b = p.size === 32, m = MAT.iron;
    p.poly(b ? [[12, 3], [20, 5], [23, 25], [19, 29], [10, 27], [8, 8]] : [[9, 2], [15, 4], [18, 19], [14, 22], [8, 20], [6, 6]], m[0]);
    p.poly(b ? [[11, 4], [18, 5], [20, 25], [17, 27], [10, 25], [9, 8]] : [[8, 3], [13, 4], [15, 19], [13, 20], [8, 19], [7, 6]], m[2]);
    p.line(b ? [[11, 4], [16, 5], [18, 14]] : [[8, 3], [12, 4], [13, 10]], m[3]);
    p.ellipse(b ? 12 : 9, b ? 8 : 6, b ? 5 : 4, b ? 6 : 4);
    p.ellipse(b ? 14 : 10, b ? 20 : 15, b ? 3 : 3, b ? 4 : 3);
    p.line(b ? [[11, 17], [17, 18]] : [[9, 13], [12, 14]], m[1]);
    p.protect(b ? 11 : 8, b ? 7 : 5, b ? 9 : 7, b ? 18 : 14);
    p.anchor = b ? [16, 26] : [12, 19];
  },
  split_tongue_bell(p) {
    const b = p.size === 32, m = MAT.brass, x = b ? 15 : 11;
    p.rect(x, b ? 3 : 2, 3, b ? 7 : 5, m[1]);
    p.line([[x, b ? 3 : 2], [x + 1, b ? 7 : 5]], m[3]);
    p.poly(b ? [[11, 9], [21, 9], [23, 20], [28, 25], [7, 27], [5, 24], [9, 19]] : [[8, 6], [15, 6], [17, 15], [21, 18], [5, 20], [3, 18], [7, 14]], m[1]);
    p.poly(b ? [[11, 10], [15, 10], [14, 19], [8, 23], [8, 20]] : [[8, 7], [11, 7], [10, 14], [6, 17], [6, 15]], m[2]);
    p.poly(b ? [[19, 10], [21, 10], [23, 20], [26, 23], [19, 21]] : [[14, 7], [15, 7], [17, 15], [19, 17], [14, 15]], m[0]);
    p.ellipse(b ? 6 : 4, b ? 22 : 16, b ? 22 : 17, b ? 6 : 5, m[0]);
    p.line(b ? [[7, 24], [13, 22], [21, 22], [26, 24]] : [[5, 18], [10, 16], [16, 16], [19, 18]], m[3]);
    p.rect(b ? 16 : 12, b ? 22 : 16, 2, b ? 4 : 3, MAT.iron[2]);
    p.rect(b ? 14 : 10, b ? 26 : 19, 2, 2, MAT.iron[1]);
    p.protect(b ? 10 : 7, b ? 21 : 15, b ? 13 : 10, b ? 7 : 6);
    p.anchor = b ? [15, 25] : [11, 18];
  },
  crooked_clay_whistle(p) {
    const b = p.size === 32, m = MAT.leather, g = MAT.ceramic;
    p.poly(b ? [[9, 17], [4, 10], [5, 4], [9, 3], [9, 9], [14, 13]] : [[7, 13], [3, 8], [4, 3], [7, 2], [7, 7], [11, 10]], m[1]);
    p.line(b ? [[5, 9], [6, 5], [8, 5]] : [[4, 7], [5, 4], [6, 4]], g[3], 2);
    p.poly(b ? [[12, 10], [21, 9], [28, 16], [27, 23], [21, 28], [11, 26], [6, 20]] : [[9, 7], [16, 7], [21, 12], [20, 18], [16, 21], [8, 20], [4, 15]], m[1]);
    p.poly(b ? [[11, 12], [20, 10], [24, 14], [20, 19], [13, 21], [8, 17]] : [[8, 9], [15, 8], [18, 11], [15, 14], [10, 16], [6, 13]], g[1]);
    p.poly(b ? [[12, 12], [19, 11], [21, 14], [16, 17], [11, 16]] : [[9, 9], [14, 8], [16, 11], [12, 13], [8, 12]], g[2]);
    p.ellipse(b ? 19 : 14, b ? 19 : 14, b ? 6 : 5, b ? 5 : 4, m[0]);
    p.ellipse(b ? 20 : 15, b ? 20 : 15, b ? 4 : 3, 2, MAT.ink);
    p.line(b ? [[10, 22], [14, 25], [19, 25]] : [[7, 17], [10, 19], [14, 19]], m[2]);
    p.protect(b ? 18 : 13, b ? 18 : 13, b ? 8 : 7, b ? 7 : 6);
    p.anchor = b ? [16, 26] : [12, 19];
  },
  missing_tooth_music_box(p) {
    const b = p.size === 32, m = MAT.wood, g = MAT.iron;
    p.poly(b ? [[7, 5], [22, 3], [24, 11], [8, 15]] : [[5, 4], [16, 2], [18, 8], [6, 11]], m[1]);
    p.poly(b ? [[9, 7], [20, 5], [21, 10], [9, 13]] : [[7, 5], [15, 4], [16, 7], [7, 9]], m[0]);
    p.line(b ? [[8, 5], [21, 3]] : [[6, 4], [16, 2]], m[3]);
    p.poly(b ? [[4, 16], [22, 11], [27, 16], [25, 27], [9, 29], [4, 25]] : [[3, 12], [16, 8], [20, 12], [19, 20], [7, 22], [3, 19]], m[0]);
    p.poly(b ? [[5, 16], [22, 12], [26, 16], [11, 21]] : [[4, 12], [16, 9], [19, 12], [8, 16]], m[2]);
    p.poly(b ? [[11, 21], [26, 17], [25, 25], [11, 28]] : [[8, 16], [19, 13], [18, 19], [8, 21]], m[1]);
    p.poly(b ? [[9, 16], [20, 13], [23, 16], [12, 19]] : [[7, 12], [14, 10], [17, 12], [9, 15]], g[0]);
    p.line(b ? [[10, 16], [12, 17], [18, 15], [20, 14]] : [[8, 12], [10, 13], [14, 11]], g[2]);
    p.rect(b ? 15 : 11, b ? 15 : 11, 2, 2, g[0]);
    p.line(b ? [[26, 21], [29, 20], [29, 16]] : [[19, 16], [22, 15], [22, 12]], MAT.brass[2]);
    p.protect(b ? 9 : 7, b ? 13 : 10, b ? 14 : 10, b ? 7 : 6);
    p.anchor = b ? [16, 26] : [12, 20];
  },
  lead_type_stamp(p) {
    const b = p.size === 32, m = MAT.iron;
    p.poly(b ? [[11, 5], [17, 3], [22, 7], [21, 15], [17, 16], [18, 9], [14, 8], [12, 12], [13, 16], [9, 17], [8, 10]] : [[8, 4], [13, 2], [17, 5], [16, 11], [13, 12], [14, 7], [11, 6], [9, 9], [10, 12], [7, 13], [6, 8]], m[1]);
    p.line(b ? [[10, 9], [12, 6], [17, 5], [20, 8]] : [[8, 7], [9, 5], [13, 4], [15, 6]], m[3]);
    p.poly(b ? [[6, 16], [22, 13], [28, 19], [25, 27], [7, 28], [3, 22]] : [[5, 12], [17, 10], [21, 14], [19, 20], [5, 21], [2, 17]], m[0]);
    p.poly(b ? [[6, 16], [22, 14], [26, 18], [9, 21], [4, 19]] : [[5, 12], [17, 11], [19, 14], [7, 16], [3, 14]], m[2]);
    p.poly(b ? [[9, 22], [26, 19], [24, 26], [8, 26]] : [[7, 17], [20, 14], [18, 19], [6, 19]], m[1]);
    p.line(b ? [[10, 24], [15, 24], [15, 22], [20, 22], [21, 24]] : [[8, 18], [11, 18], [11, 16], [15, 16], [16, 18]], m[0]);
    p.protect(b ? 10 : 8, b ? 4 : 3, b ? 11 : 8, b ? 12 : 9);
    p.anchor = b ? [16, 26] : [12, 20];
  },
  broken_eye_scale_weight(p) {
    const b = p.size === 32, m = MAT.iron;
    p.line(b ? [[12, 10], [10, 6], [12, 3], [17, 3], [19, 6]] : [[9, 8], [8, 5], [10, 2], [13, 2], [15, 4]], m[1], 2);
    p.line(b ? [[12, 5], [15, 4], [18, 6]] : [[10, 4], [12, 3], [14, 5]], m[3]);
    p.poly(b ? [[10, 10], [20, 9], [22, 15], [28, 23], [24, 28], [8, 28], [4, 23], [7, 16]] : [[8, 8], [15, 7], [17, 11], [21, 17], [18, 21], [6, 21], [3, 17], [5, 12]], m[0]);
    p.poly(b ? [[10, 11], [14, 10], [13, 18], [10, 24], [6, 23], [8, 16]] : [[8, 9], [11, 8], [10, 14], [8, 18], [5, 17], [6, 12]], m[2]);
    p.poly(b ? [[17, 11], [20, 11], [22, 17], [25, 23], [20, 25], [17, 21]] : [[13, 9], [15, 9], [16, 13], [19, 17], [15, 19], [13, 16]], m[1]);
    p.line(b ? [[10, 11], [10, 15], [8, 21]] : [[8, 9], [8, 12], [6, 16]], m[3]);
    p.protect(b ? 10 : 8, 2, b ? 11 : 9, b ? 8 : 6);
    p.anchor = b ? [16, 26] : [12, 19];
  },
  waterlogged_spine(p) {
    const b = p.size === 32, m = MAT.bone;
    const segments = b ? [[7, 6, 11, 9], [10, 13, 12, 10], [15, 20, 11, 8]] : [[5, 4, 9, 7], [8, 10, 9, 8], [12, 16, 9, 6]];
    p.line(b ? [[11, 9], [14, 17], [19, 24]] : [[8, 6], [11, 13], [16, 19]], m[0], 3);
    for (const [x, y, w, h] of segments) {
      p.poly([[x, y + 2], [x + 3, y], [x + w - 2, y + 1], [x + w, y + h - 3], [x + w - 3, y + h], [x + 2, y + h - 1], [x - 2, y + h - 4]], m[1]);
      p.poly([[x + 1, y + 2], [x + 4, y + 1], [x + w - 3, y + 2], [x + w - 4, y + h - 3], [x + 1, y + h - 3]], m[2]);
      p.rect(x + 3, y + 3, b ? 3 : 2, 2, MAT.ink);
      p.line([[x, y + 2], [x + 3, y]], m[3]);
    }
    p.protect(b ? 7 : 5, b ? 6 : 4, b ? 17 : 14, b ? 19 : 16);
    p.anchor = b ? [20, 26] : [16, 20];
  },
  silver_back_hand_mirror(p) {
    const b = p.size === 32, m = MAT.iron, g = MAT.glass;
    p.poly(b ? [[15, 20], [19, 19], [25, 27], [21, 29], [16, 24]] : [[11, 15], [14, 14], [20, 20], [17, 22], [12, 18]], m[1]);
    p.ellipse(b ? 4 : 3, b ? 3 : 2, b ? 20 : 16, b ? 22 : 16, m[1]);
    p.ellipse(b ? 5 : 4, b ? 4 : 3, b ? 17 : 13, b ? 18 : 13, g[0]);
    p.poly(b ? [[9, 5], [18, 6], [19, 10], [10, 18], [7, 14]] : [[7, 4], [14, 5], [15, 7], [8, 13], [5, 10]], g[1]);
    p.line(b ? [[7, 11], [11, 6], [16, 6]] : [[5, 9], [8, 4], [12, 4]], g[3]);
    p.line(b ? [[11, 18], [18, 12], [20, 13]] : [[8, 13], [13, 9], [15, 10]], g[2]);
    p.line(b ? [[5, 15], [7, 20], [12, 23]] : [[4, 11], [6, 15], [9, 17]], m[3]);
    p.protect(b ? 6 : 4, b ? 4 : 3, b ? 16 : 12, b ? 17 : 13);
    p.anchor = b ? [22, 27] : [17, 20];
  },
  empty_photo_frame(p) {
    const b = p.size === 32, m = MAT.wood;
    p.poly(b ? [[18, 10], [22, 11], [27, 27], [21, 27]] : [[14, 8], [17, 9], [21, 21], [16, 21]], m[0]);
    p.poly(b ? [[5, 4], [23, 7], [23, 13], [21, 13], [22, 26], [5, 24]] : [[4, 3], [17, 5], [18, 10], [16, 10], [17, 20], [4, 18]], m[1]);
    p.poly(b ? [[8, 8], [20, 10], [19, 22], [8, 20]] : [[6, 6], [15, 8], [14, 17], [6, 15]], MAT.paper[1]);
    p.poly(b ? [[8, 8], [20, 10], [16, 13], [8, 17]] : [[6, 6], [15, 8], [12, 10], [6, 13]], MAT.paper[2]);
    p.line(b ? [[5, 5], [20, 8]] : [[4, 4], [16, 6]], m[3]);
    p.line(b ? [[6, 7], [6, 22], [20, 24]] : [[5, 6], [5, 17], [15, 19]], m[2]);
    p.protect(b ? 8 : 6, b ? 8 : 6, b ? 12 : 9, b ? 13 : 10);
    p.anchor = b ? [14, 24] : [11, 18];
  },
  inverted_face_mask(p) {
    const b = p.size === 32, m = MAT.bone;
    p.line(b ? [[7, 12], [3, 15], [4, 23], [9, 24]] : [[5, 9], [2, 12], [3, 18], [7, 19]], MAT.leather[1]);
    p.poly(b ? [[10, 4], [21, 4], [26, 10], [24, 20], [17, 28], [10, 24], [6, 12]] : [[8, 3], [16, 3], [20, 8], [18, 15], [13, 22], [8, 18], [5, 9]], m[1]);
    p.poly(b ? [[10, 5], [18, 5], [20, 12], [18, 21], [15, 25], [10, 21], [8, 12]] : [[8, 4], [14, 4], [15, 9], [14, 16], [12, 19], [8, 16], [6, 9]], m[2]);
    p.line(b ? [[12, 8], [18, 8]] : [[9, 6], [14, 6]], m[0]);
    p.poly(b ? [[15, 11], [13, 16], [17, 16]] : [[11, 8], [10, 12], [13, 12]], m[3]);
    p.line(b ? [[10, 19], [13, 18], [14, 19]] : [[8, 14], [10, 13], [11, 14]], m[0]);
    p.line(b ? [[18, 19], [20, 18], [22, 18]] : [[14, 14], [16, 13], [17, 13]], m[0]);
    p.protect(b ? 10 : 8, b ? 7 : 5, b ? 13 : 10, b ? 14 : 11);
    p.anchor = b ? [15, 25] : [12, 19];
  },
  blind_needle_compass(p) {
    const b = p.size === 32, m = MAT.brass;
    p.poly(b ? [[6, 4], [16, 2], [21, 6], [19, 12], [8, 15], [4, 10]] : [[5, 3], [12, 1], [16, 5], [14, 9], [6, 11], [3, 8]], m[0]);
    p.poly(b ? [[7, 5], [15, 4], [18, 7], [16, 10], [8, 12], [6, 9]] : [[6, 4], [12, 3], [14, 5], [12, 8], [6, 9], [5, 7]], m[1]);
    p.poly(b ? [[6, 14], [20, 10], [28, 17], [27, 23], [20, 28], [8, 27], [3, 22], [3, 17]] : [[5, 11], [15, 8], [21, 13], [20, 18], [15, 22], [6, 21], [2, 17], [2, 13]], m[1]);
    p.ellipse(b ? 7 : 5, b ? 13 : 10, b ? 18 : 14, b ? 13 : 10, MAT.paper[1]);
    p.ellipse(b ? 9 : 7, b ? 15 : 12, b ? 14 : 10, b ? 9 : 6, MAT.paper[2]);
    p.poly(b ? [[15, 23], [13, 18], [14, 10], [18, 18]] : [[11, 18], [10, 14], [10, 8], [14, 14]], MAT.iron[0]);
    p.line(b ? [[14, 11], [14, 17]] : [[10, 9], [11, 13]], MAT.iron[2]);
    p.line(b ? [[8, 15], [11, 13], [18, 12]] : [[6, 12], [9, 10], [14, 9]], m[3]);
    p.protect(b ? 8 : 6, b ? 11 : 9, b ? 16 : 12, b ? 14 : 11);
    p.anchor = b ? [15, 26] : [12, 20];
  },
  creased_negative(p) {
    const b = p.size === 32, m = MAT.leather, g = MAT.glass;
    p.poly(b ? [[5, 5], [18, 3], [22, 14], [27, 21], [17, 28], [6, 24]] : [[4, 4], [13, 2], [16, 10], [20, 16], [13, 22], [5, 18]], m[0]);
    p.poly(b ? [[7, 7], [16, 5], [18, 13], [8, 15]] : [[6, 5], [12, 4], [14, 10], [6, 11]], g[0]);
    p.poly(b ? [[8, 17], [19, 15], [24, 21], [16, 25], [8, 23]] : [[6, 13], [14, 12], [18, 16], [12, 19], [6, 17]], g[1]);
    p.line(b ? [[8, 11], [11, 10], [13, 12], [17, 11]] : [[6, 8], [8, 7], [10, 9], [13, 8]], g[1]);
    p.line(b ? [[10, 21], [14, 20], [16, 22], [21, 20]] : [[7, 16], [10, 15], [12, 17], [16, 15]], g[0]);
    for (const [x, y] of b ? [[5, 8], [5, 12], [6, 17], [7, 22], [18, 8], [20, 12], [24, 19]] : [[4, 6], [4, 9], [5, 13], [5, 16], [14, 6], [15, 9], [18, 14]]) p.rect(x, y, 1, 2);
    p.poly(b ? [[17, 4], [20, 9], [16, 9]] : [[12, 3], [15, 7], [12, 7]], MAT.paper[2]);
    p.protect(b ? 6 : 5, b ? 5 : 4, b ? 18 : 13, b ? 20 : 15);
    p.anchor = b ? [14, 25] : [11, 19];
  },
  one_eyed_puppet_head(p) {
    const b = p.size === 32, m = MAT.wood;
    p.poly(b ? [[6, 7], [13, 3], [24, 6], [27, 17], [23, 26], [12, 28], [5, 22]] : [[5, 5], [10, 2], [18, 4], [21, 13], [18, 20], [9, 22], [4, 17]], m[0]);
    p.poly(b ? [[7, 8], [13, 5], [22, 7], [23, 20], [18, 25], [8, 22]] : [[6, 6], [10, 4], [16, 5], [18, 16], [13, 19], [6, 17]], m[2]);
    p.poly(b ? [[22, 7], [25, 11], [25, 20], [22, 25], [18, 26], [21, 20]] : [[17, 5], [19, 8], [19, 16], [17, 19], [14, 20], [16, 15]], m[1]);
    p.ellipse(b ? 9 : 7, b ? 10 : 8, b ? 10 : 8, b ? 11 : 8, MAT.bone[1]);
    p.ellipse(b ? 12 : 9, b ? 12 : 9, b ? 5 : 4, b ? 6 : 5, MAT.ink);
    p.rect(b ? 12 : 9, b ? 12 : 9, 2, 2, MAT.glass[3]);
    p.rect(b ? 13 : 10, b ? 25 : 19, b ? 7 : 5, 3, MAT.ink);
    p.line(b ? [[20, 11], [20, 17]] : [[16, 8], [16, 13]], m[0]);
    p.protect(b ? 8 : 6, b ? 9 : 7, b ? 12 : 10, b ? 13 : 10);
    p.anchor = b ? [18, 25] : [14, 19];
  },
  cold_ash_pipe(p) {
    const b = p.size === 32, m = MAT.wood;
    p.poly(b ? [[3, 7], [7, 7], [10, 15], [15, 19], [18, 18], [18, 23], [13, 24], [7, 19]] : [[2, 5], [5, 5], [8, 11], [11, 14], [14, 13], [14, 17], [10, 18], [5, 14]], m[0]);
    p.line(b ? [[4, 8], [8, 16], [13, 21], [17, 21]] : [[3, 6], [6, 12], [10, 16], [13, 16]], m[2], 2);
    p.poly(b ? [[17, 11], [27, 10], [29, 15], [27, 26], [21, 29], [16, 25], [15, 16]] : [[13, 8], [20, 7], [22, 11], [20, 20], [16, 22], [12, 19], [11, 12]], m[1]);
    p.ellipse(b ? 16 : 12, b ? 10 : 7, b ? 12 : 9, b ? 8 : 6, m[2]);
    p.ellipse(b ? 18 : 14, b ? 11 : 8, b ? 8 : 5, b ? 5 : 4, MAT.iron[0]);
    p.line(b ? [[18, 14], [22, 12], [25, 13]] : [[14, 10], [16, 9], [18, 9]], MAT.iron[2]);
    p.line(b ? [[19, 20], [20, 25], [23, 26]] : [[14, 15], [15, 19], [18, 20]], m[2]);
    p.protect(b ? 17 : 13, b ? 10 : 7, b ? 11 : 8, b ? 8 : 7);
    p.anchor = b ? [22, 26] : [16, 20];
  },
  ceramic_charcoal_box(p) {
    const b = p.size === 32, m = MAT.ceramic;
    p.poly(b ? [[6, 7], [19, 4], [24, 8], [22, 15], [8, 17]] : [[5, 5], [14, 3], [18, 6], [16, 11], [6, 13]], m[0]);
    p.poly(b ? [[7, 7], [19, 5], [22, 8], [9, 12]] : [[6, 5], [14, 4], [16, 6], [7, 9]], m[2]);
    p.poly(b ? [[5, 16], [21, 12], [27, 17], [25, 27], [10, 29], [4, 23]] : [[4, 12], [16, 9], [20, 13], [19, 20], [8, 22], [3, 18]], m[1]);
    p.poly(b ? [[7, 17], [21, 14], [24, 18], [12, 23], [6, 21]] : [[6, 13], [16, 11], [18, 14], [9, 17], [5, 16]], m[0]);
    p.poly(b ? [[10, 17], [18, 15], [23, 18], [16, 21], [10, 20]] : [[8, 13], [14, 12], [17, 14], [12, 16], [8, 15]], MAT.iron[0]);
    p.line(b ? [[11, 18], [15, 17], [18, 19], [21, 18]] : [[9, 14], [12, 13], [14, 15], [16, 14]], MAT.iron[1]);
    p.line(b ? [[5, 17], [5, 23], [10, 27], [22, 25]] : [[4, 13], [4, 18], [8, 20], [17, 18]], m[3]);
    p.line(b ? [[25, 17], [29, 16], [29, 20], [26, 22]] : [[19, 13], [22, 12], [22, 15], [20, 16]], m[2]);
    p.protect(b ? 8 : 6, b ? 14 : 10, b ? 16 : 12, b ? 8 : 7);
    p.anchor = b ? [15, 26] : [12, 20];
  },
  frosted_furnace_core(p) {
    const b = p.size === 32, m = MAT.iron;
    p.poly(b ? [[9, 5], [22, 5], [26, 10], [24, 25], [21, 28], [7, 26], [5, 11]] : [[7, 4], [17, 4], [20, 8], [18, 19], [16, 22], [5, 20], [4, 9]], m[0]);
    const ribs = b ? [[8, 8, 3, 17], [14, 6, 4, 20], [22, 8, 3, 17]] : [[6, 7, 2, 12], [11, 5, 3, 15], [17, 7, 2, 12]];
    for (const [x, y, w, h] of ribs) {
      p.rect(x, y, w, h, m[1]);
      p.line([[x, y], [x, y + h - 2]], m[2]);
    }
    p.line(b ? [[12, 10], [12, 17], [10, 20]] : [[9, 8], [9, 13], [8, 16]], MAT.bone[2], 2);
    p.line(b ? [[19, 8], [19, 14], [20, 17]] : [[15, 7], [15, 11], [16, 13]], MAT.bone[3]);
    p.rect(b ? 7 : 5, b ? 25 : 19, 5, 3, m[2]);
    p.rect(b ? 21 : 16, b ? 25 : 19, 5, 3, m[1]);
    p.line(b ? [[10, 5], [21, 5]] : [[8, 4], [16, 4]], m[3]);
    p.protect(b ? 10 : 8, b ? 8 : 6, b ? 12 : 9, b ? 16 : 12);
    p.anchor = b ? [16, 26] : [12, 20];
  },
  sealed_flower_calyx(p) {
    const b = p.size === 32, m = MAT.ceramic;
    p.poly(b ? [[6, 12], [8, 5], [15, 8], [21, 3], [25, 11], [28, 15], [23, 24], [17, 28], [9, 24], [4, 19]] : [[5, 9], [6, 4], [11, 6], [16, 2], [19, 8], [21, 11], [17, 18], [13, 22], [7, 18], [3, 14]], m[0]);
    p.poly(b ? [[8, 7], [15, 10], [16, 23], [10, 22], [6, 16]] : [[6, 5], [11, 8], [12, 17], [8, 16], [5, 12]], m[2]);
    p.poly(b ? [[21, 5], [24, 12], [21, 22], [17, 25], [17, 12]] : [[16, 4], [18, 9], [16, 16], [13, 19], [13, 9]], m[1]);
    p.poly(b ? [[11, 11], [15, 10], [19, 13], [17, 18], [13, 17]] : [[8, 9], [11, 8], [14, 10], [13, 14], [10, 13]], m[0]);
    p.line(b ? [[8, 7], [10, 13], [11, 19]] : [[6, 5], [8, 10], [8, 14]], m[3]);
    p.line(b ? [[24, 13], [25, 17], [22, 22]] : [[19, 10], [19, 13], [17, 16]], m[2]);
    p.protect(b ? 10 : 8, b ? 10 : 8, b ? 11 : 8, b ? 11 : 8);
    p.anchor = b ? [16, 25] : [12, 19];
  },
  split_porcelain_spoon(p) {
    const b = p.size === 32, m = MAT.bone;
    p.poly(b ? [[5, 3], [9, 3], [13, 13], [11, 18], [8, 12]] : [[4, 2], [7, 2], [10, 10], [8, 14], [6, 9]], m[1]);
    p.line(b ? [[6, 4], [9, 12], [11, 15]] : [[5, 3], [7, 9], [8, 11]], m[3], 2);
    p.poly(b ? [[13, 13], [21, 13], [26, 18], [25, 25], [20, 28], [12, 24], [9, 18]] : [[10, 10], [16, 10], [20, 14], [19, 19], [15, 22], [9, 18], [7, 14]], m[1]);
    p.poly(b ? [[13, 15], [19, 15], [19, 19], [15, 23], [12, 21], [11, 18]] : [[10, 12], [14, 12], [14, 15], [11, 18], [9, 16], [8, 14]], m[3]);
    p.poly(b ? [[23, 16], [25, 19], [23, 25], [20, 26], [18, 24], [21, 20]] : [[17, 12], [19, 15], [17, 19], [15, 20], [13, 18], [16, 15]], m[2]);
    p.line(b ? [[20, 14], [20, 18], [18, 22], [16, 25]] : [[15, 11], [15, 14], [13, 17], [12, 19]], MAT.ink);
    p.rect(b ? 17 : 13, b ? 25 : 19, 2, 2);
    p.protect(b ? 11 : 8, b ? 13 : 10, b ? 15 : 12, b ? 14 : 12);
    p.anchor = b ? [18, 26] : [14, 20];
  }
};

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/art/contaminant-catalog-icons-secondary.ts
var SECONDARY_OBJECTS = {
  salted_vial(p) {
    const b = p.size === 32, g = MAT.glass;
    const x = b ? 8 : 6, y = b ? 11 : 8, w = b ? 17 : 13, h = b ? 17 : 13;
    p.poly([[x + 4, y - 5], [x + w - 4, y - 5], [x + w - 4, y - 1], [x + w, y + 3], [x + w, y + h - 3], [x + w - 3, y + h], [x + 2, y + h], [x, y + h - 3], [x, y + 3], [x + 4, y - 1]], g[0]);
    p.poly([[x + 2, y + 3], [x + w - 2, y + 3], [x + w - 2, y + h - 3], [x + 3, y + h - 2]], g[1]);
    p.poly([[x + 3, y + h - 7], [x + w - 3, y + h - 11], [x + w - 3, y + h - 3], [x + 3, y + h - 3]], MAT.plum[1]);
    p.rect(x + 3, y - 7, w - 6, 4, MAT.wood[1]);
    p.line([[x + 3, y - 7], [x + w - 4, y - 7]], MAT.wood[3]);
    p.line([[x + 2, y + 3], [x + 2, y + h - 5]], g[3]);
    p.line([[x + 3, y], [x + 3, y - 3], [x + 5, y - 4]], MAT.bone[3], 2);
    p.protect(x + 3, y + 2, w - 6, h - 4);
    p.anchor = [x + Math.floor(w / 2), y + h - 2];
  },
  bone_clasp_mask(p) {
    const b = p.size === 32, c = MAT.cloth, o = MAT.bone;
    p.line(b ? [[7, 9], [3, 10], [2, 17], [7, 21]] : [[5, 7], [2, 8], [2, 13], [5, 16]], MAT.leather[1]);
    p.line(b ? [[23, 10], [28, 12], [29, 20], [24, 22]] : [[18, 8], [21, 10], [21, 16], [18, 17]], MAT.leather[1]);
    p.poly(b ? [[6, 9], [14, 6], [25, 10], [25, 20], [18, 25], [8, 23], [5, 17]] : [[5, 7], [11, 4], [19, 8], [19, 15], [14, 19], [6, 17], [4, 13]], c[1]);
    p.poly(b ? [[7, 10], [14, 8], [17, 13], [14, 22], [8, 20]] : [[6, 8], [11, 6], [13, 10], [11, 16], [6, 15]], c[2]);
    p.line(b ? [[10, 12], [18, 12], [20, 15], [10, 15], [12, 19], [19, 19]] : [[8, 9], [14, 9], [16, 12], [8, 12], [9, 15], [14, 15]], c[0]);
    p.rect(b ? 6 : 5, b ? 12 : 9, 3, b ? 7 : 5, o[2]);
    p.rect(b ? 23 : 18, b ? 13 : 10, 3, b ? 6 : 5, o[1]);
    p.dot(b ? 7 : 6, b ? 13 : 10, o[3]);
    p.protect(b ? 9 : 7, b ? 9 : 7, b ? 13 : 10, b ? 12 : 9);
    p.anchor = b ? [16, 23] : [12, 17];
  },
  lead_fastened_breastplate(p) {
    const b = p.size === 32, m = MAT.iron, c = MAT.leather;
    p.poly(b ? [[8, 5], [24, 6], [28, 12], [24, 27], [11, 29], [5, 18]] : [[6, 4], [18, 5], [21, 9], [18, 20], [8, 22], [4, 14]], c[0]);
    p.poly(b ? [[7, 6], [12, 4], [14, 8], [20, 8], [23, 4], [26, 8], [24, 19], [20, 26], [11, 26], [6, 17]] : [[5, 5], [9, 3], [11, 6], [15, 6], [17, 3], [20, 6], [18, 15], [15, 20], [8, 20], [4, 13]], m[1]);
    p.poly(b ? [[9, 7], [12, 6], [14, 10], [15, 22], [10, 22], [8, 16]] : [[7, 6], [9, 5], [11, 8], [11, 17], [7, 17], [6, 12]], m[2]);
    p.poly(b ? [[20, 10], [23, 7], [23, 18], [19, 23], [17, 20]] : [[15, 8], [18, 6], [17, 14], [14, 18], [13, 15]], m[0]);
    p.rect(b ? 17 : 13, b ? 12 : 9, 5, 4, MAT.bone[1]);
    p.rect(b ? 18 : 14, b ? 13 : 10, 2, 2, m[0]);
    p.line(b ? [[11, 25], [18, 25], [20, 28], [14, 27]] : [[8, 19], [13, 19], [15, 21], [10, 20]], c[2]);
    p.protect(b ? 12 : 9, b ? 5 : 4, b ? 11 : 9, b ? 15 : 11);
    p.anchor = b ? [16, 26] : [12, 20];
  },
  split_heel_boot(p) {
    const b = p.size === 32, m = MAT.leather;
    p.poly(b ? [[8, 3], [20, 4], [19, 17], [27, 20], [29, 25], [25, 28], [13, 28], [6, 23], [6, 13]] : [[6, 2], [15, 3], [14, 13], [20, 15], [22, 19], [18, 21], [10, 21], [4, 17], [4, 10]], m[0]);
    p.poly(b ? [[10, 5], [18, 5], [16, 17], [21, 20], [25, 21], [26, 25], [16, 25], [9, 21], [8, 14]] : [[8, 4], [13, 4], [12, 13], [16, 15], [19, 16], [19, 19], [12, 19], [7, 16], [6, 11]], m[1]);
    p.line(b ? [[10, 6], [17, 6], [16, 14], [13, 16]] : [[8, 5], [12, 5], [11, 11], [10, 12]], m[2]);
    p.line(b ? [[17, 20], [24, 23], [25, 25]] : [[13, 15], [18, 17], [19, 19]], m[3]);
    p.rect(b ? 7 : 5, b ? 24 : 18, b ? 5 : 4, 2);
    p.rect(b ? 7 : 5, b ? 27 : 21, b ? 5 : 4, 2, m[1]);
    p.protect(b ? 7 : 5, b ? 23 : 17, b ? 8 : 6, b ? 6 : 6);
    p.anchor = b ? [20, 26] : [15, 20];
  },
  coiled_tape_measure(p) {
    const b = p.size === 32, m = MAT.brass;
    p.ellipse(b ? 3 : 2, b ? 5 : 4, b ? 22 : 17, b ? 21 : 16, m[0]);
    p.ellipse(b ? 4 : 3, b ? 5 : 4, b ? 19 : 14, b ? 17 : 13, m[1]);
    p.poly(b ? [[6, 9], [11, 6], [17, 7], [20, 11], [16, 14], [8, 14]] : [[5, 7], [9, 5], [13, 6], [15, 9], [12, 11], [6, 11]], m[2]);
    p.ellipse(b ? 9 : 7, b ? 10 : 8, b ? 8 : 6, b ? 8 : 6, MAT.iron[1]);
    p.ellipse(b ? 11 : 9, b ? 12 : 10, b ? 4 : 3, b ? 4 : 3, MAT.iron[0]);
    p.poly(b ? [[19, 20], [25, 18], [29, 20], [28, 26], [18, 29], [12, 26], [14, 23], [19, 25], [26, 23], [26, 21], [21, 23]] : [[15, 15], [19, 13], [22, 15], [21, 20], [14, 22], [9, 20], [10, 17], [14, 19], [19, 18], [19, 16], [16, 18]], MAT.paper[2]);
    p.line(b ? [[16, 27], [20, 27], [20, 25], [25, 25]] : [[12, 20], [15, 20], [15, 19], [18, 19]], MAT.paper[0]);
    p.protect(b ? 9 : 7, b ? 10 : 8, b ? 8 : 6, b ? 8 : 6);
    p.anchor = b ? [17, 26] : [13, 20];
  },
  hollow_loom_shuttle(p) {
    const b = p.size === 32, m = MAT.wood;
    p.poly(b ? [[2, 18], [8, 9], [22, 4], [29, 10], [24, 20], [10, 27]] : [[1, 14], [6, 7], [17, 3], [22, 7], [18, 15], [8, 21]], m[0]);
    p.poly(b ? [[4, 17], [10, 10], [22, 6], [26, 10], [21, 16], [10, 24]] : [[3, 13], [8, 8], [16, 5], [19, 8], [15, 12], [8, 18]], m[2]);
    p.poly(b ? [[10, 16], [20, 10], [23, 11], [19, 16], [11, 21], [8, 21]] : [[8, 12], [15, 8], [17, 9], [14, 12], [8, 16], [6, 16]]);
    p.line(b ? [[8, 11], [18, 7], [21, 7]] : [[6, 9], [13, 5], [16, 5]], m[3]);
    p.poly(b ? [[23, 5], [29, 10], [26, 15], [24, 11], [21, 9]] : [[18, 4], [22, 7], [20, 11], [18, 8], [16, 7]], MAT.brass[1]);
    p.line(b ? [[23, 6], [27, 10]] : [[18, 5], [20, 7]], MAT.brass[3]);
    p.protect(b ? 8 : 6, b ? 10 : 8, b ? 16 : 12, b ? 12 : 9);
    p.anchor = b ? [11, 24] : [8, 19];
  },
  gray_felt_glove(p) {
    const b = p.size === 32, m = MAT.cloth;
    p.poly(b ? [[8, 6], [12, 3], [18, 4], [21, 8], [21, 13], [25, 10], [28, 14], [24, 21], [23, 27], [11, 29], [7, 24]] : [[6, 4], [9, 2], [14, 3], [16, 6], [16, 10], [19, 8], [21, 11], [18, 16], [17, 21], [8, 22], [5, 18]], m[0]);
    p.poly(b ? [[9, 7], [12, 5], [17, 6], [19, 10], [18, 19], [13, 24], [9, 22]] : [[7, 5], [9, 4], [13, 5], [14, 8], [13, 15], [10, 18], [7, 16]], m[2]);
    p.poly(b ? [[18, 18], [25, 12], [26, 15], [21, 22], [21, 26], [12, 27], [12, 24]] : [[13, 14], [19, 10], [19, 12], [16, 17], [16, 20], [9, 20], [9, 18]], m[1]);
    p.line(b ? [[12, 13], [15, 17], [13, 21]] : [[9, 10], [11, 13], [10, 16]], m[0]);
    p.line(b ? [[10, 25], [20, 25]] : [[8, 19], [15, 19]], m[3]);
    p.protect(b ? 18 : 14, b ? 10 : 8, b ? 10 : 7, b ? 13 : 10);
    p.anchor = b ? [16, 27] : [12, 20];
  },
  scorched_scarf(p) {
    const b = p.size === 32, m = MAT.plum;
    p.poly(b ? [[8, 4], [20, 3], [25, 8], [22, 17], [24, 26], [19, 29], [15, 21], [10, 25], [5, 22], [8, 15], [4, 10]] : [[6, 3], [15, 2], [19, 6], [16, 13], [18, 20], [14, 22], [11, 16], [7, 19], [3, 17], [6, 11], [3, 7]], m[0]);
    p.poly(b ? [[8, 5], [19, 5], [22, 9], [19, 15], [17, 12], [18, 8], [10, 8], [8, 11], [11, 14], [13, 19], [10, 23], [7, 22], [10, 17], [6, 10]] : [[6, 4], [14, 4], [16, 7], [14, 11], [12, 9], [13, 6], [8, 6], [6, 8], [9, 10], [10, 14], [7, 17], [5, 16], [7, 12], [4, 7]], m[1]);
    p.poly(b ? [[17, 14], [21, 16], [23, 26], [20, 27], [18, 21], [15, 18]] : [[13, 11], [16, 13], [17, 20], [15, 20], [13, 16], [11, 14]], m[2]);
    p.line(b ? [[8, 7], [13, 5], [19, 6]] : [[6, 5], [10, 4], [14, 5]], m[3]);
    p.protect(b ? 9 : 7, b ? 7 : 5, b ? 10 : 8, b ? 10 : 8);
    p.anchor = b ? [20, 26] : [15, 20];
  },
  unlined_coat(p) {
    const b = p.size === 32, m = MAT.leather, c = MAT.cloth;
    p.poly(b ? [[10, 4], [22, 5], [25, 10], [28, 19], [24, 22], [21, 17], [23, 28], [8, 29], [5, 22], [7, 12]] : [[8, 3], [17, 4], [19, 8], [22, 14], [18, 17], [16, 13], [17, 21], [6, 22], [4, 17], [5, 9]], m[0]);
    p.poly(b ? [[10, 6], [15, 9], [18, 6], [22, 7], [21, 17], [20, 25], [10, 27], [8, 21]] : [[8, 5], [11, 7], [13, 5], [16, 6], [15, 13], [15, 19], [8, 20], [6, 16]], m[1]);
    p.poly(b ? [[10, 5], [16, 8], [13, 14], [9, 10]] : [[8, 4], [12, 6], [10, 10], [7, 7]], m[3]);
    p.poly(b ? [[20, 5], [23, 8], [18, 14], [16, 9]] : [[15, 4], [17, 6], [13, 10], [12, 7]], m[2]);
    p.poly(b ? [[9, 24], [16, 23], [21, 26], [19, 29], [9, 28]] : [[7, 18], [12, 17], [16, 20], [14, 22], [7, 21]], c[2]);
    p.line(b ? [[12, 17], [16, 17], [16, 20]] : [[9, 13], [12, 13], [12, 15]], m[0]);
    p.protect(b ? 9 : 7, b ? 4 : 3, b ? 14 : 11, b ? 12 : 9);
    p.anchor = b ? [15, 27] : [11, 20];
  },
  crooked_hook_needle(p) {
    const b = p.size === 32, m = MAT.iron, c = MAT.paper;
    p.line(b ? [[8, 27], [16, 11], [18, 5], [22, 3], [26, 6], [24, 10]] : [[6, 21], [12, 9], [14, 4], [17, 2], [20, 5], [18, 8]], m[1], 2);
    p.line(b ? [[9, 25], [15, 13], [19, 5], [22, 4]] : [[7, 19], [11, 11], [15, 4], [17, 3]], m[3]);
    p.line(b ? [[13, 14], [9, 12], [5, 16], [6, 21], [12, 23], [17, 18], [13, 14]] : [[10, 11], [7, 9], [3, 12], [4, 16], [9, 18], [13, 14], [10, 11]], c[1], 2);
    p.line(b ? [[7, 15], [6, 19], [11, 21], [15, 17], [20, 17], [19, 23], [13, 25]] : [[5, 12], [4, 15], [8, 16], [11, 13], [15, 13], [14, 18], [10, 19]], c[3]);
    p.protect(b ? 17 : 13, b ? 2 : 1, b ? 11 : 9, b ? 11 : 9);
    p.anchor = b ? [10, 25] : [8, 19];
  },
  wooden_thread_spool(p) {
    const b = p.size === 32, m = MAT.wood, c = MAT.paper;
    p.poly(b ? [[5, 10], [11, 6], [15, 21], [10, 28], [5, 26], [3, 17]] : [[4, 8], [8, 5], [11, 16], [8, 21], [4, 20], [2, 13]], m[1]);
    p.poly(b ? [[20, 4], [25, 6], [28, 16], [24, 21], [20, 17], [17, 7]] : [[15, 3], [19, 5], [21, 12], [18, 16], [15, 13], [13, 5]], m[0]);
    p.poly(b ? [[10, 9], [20, 6], [25, 17], [14, 24]] : [[8, 7], [15, 5], [19, 13], [11, 18]], c[1]);
    p.poly(b ? [[10, 9], [20, 6], [21, 10], [12, 14]] : [[8, 7], [15, 5], [16, 8], [9, 11]], c[2]);
    p.line(b ? [[13, 11], [22, 8], [22, 11], [15, 14], [16, 17], [24, 13], [24, 16], [17, 20]] : [[10, 8], [16, 7], [17, 9], [11, 11], [12, 13], [18, 10], [18, 12], [13, 15]], c[0]);
    p.line(b ? [[5, 12], [8, 10], [11, 22], [9, 25]] : [[4, 10], [6, 8], [8, 17], [6, 19]], m[3]);
    p.line(b ? [[20, 20], [21, 25], [16, 27], [11, 24]] : [[15, 15], [16, 19], [12, 21], [9, 18]], c[2]);
    p.protect(b ? 10 : 8, b ? 6 : 5, b ? 15 : 11, b ? 17 : 13);
    p.anchor = b ? [13, 25] : [10, 19];
  },
  double_clasp_strap(p) {
    const b = p.size === 32, m = MAT.leather, g = MAT.brass;
    p.poly(b ? [[6, 5], [10, 5], [11, 18], [16, 23], [22, 19], [23, 7], [27, 8], [26, 23], [17, 29], [8, 25], [5, 17]] : [[4, 4], [7, 4], [8, 14], [12, 18], [17, 14], [17, 5], [21, 6], [20, 18], [13, 22], [6, 19], [4, 13]], m[1]);
    p.line(b ? [[7, 9], [9, 20], [16, 26], [24, 21]] : [[5, 7], [7, 15], [12, 20], [18, 16]], m[2]);
    p.rect(b ? 4 : 3, b ? 3 : 2, b ? 9 : 7, b ? 9 : 7, g[1]);
    p.rect(b ? 6 : 5, b ? 5 : 4, b ? 5 : 3, b ? 5 : 3);
    p.line(b ? [[5, 4], [11, 4]] : [[4, 3], [8, 3]], g[3]);
    p.poly(b ? [[21, 3], [27, 4], [29, 8], [26, 13], [21, 12], [19, 7]] : [[16, 2], [21, 3], [22, 6], [20, 10], [16, 9], [14, 5]], g[0]);
    p.poly(b ? [[22, 5], [26, 6], [27, 8], [25, 10], [22, 10], [21, 7]] : [[17, 4], [20, 4], [21, 6], [19, 8], [17, 7], [16, 5]]);
    p.line(b ? [[26, 6], [23, 10], [23, 15]] : [[20, 4], [18, 7], [18, 11]], g[2]);
    p.protect(b ? 4 : 3, b ? 3 : 2, b ? 25 : 20, b ? 11 : 9);
    p.anchor = b ? [16, 26] : [12, 20];
  },
  brass_back_buckle(p) {
    const b = p.size === 32, m = MAT.brass, c = MAT.leather;
    p.poly(b ? [[10, 3], [20, 4], [23, 28], [10, 29], [8, 21]] : [[8, 2], [15, 3], [18, 21], [8, 22], [6, 16]], c[0]);
    p.line(b ? [[12, 5], [13, 26], [20, 26]] : [[10, 4], [10, 20], [15, 20]], c[2]);
    p.poly(b ? [[5, 10], [24, 7], [28, 19], [25, 24], [6, 26], [3, 18]] : [[4, 8], [18, 5], [21, 14], [19, 18], [5, 20], [2, 13]], m[1]);
    p.poly(b ? [[8, 12], [13, 11], [14, 21], [8, 22]] : [[6, 10], [10, 9], [11, 16], [6, 17]]);
    p.poly(b ? [[17, 10], [22, 10], [24, 18], [18, 20]] : [[13, 8], [17, 8], [18, 14], [14, 15]]);
    p.line(b ? [[6, 10], [22, 8], [25, 12]] : [[5, 8], [16, 6], [18, 9]], m[3]);
    p.line(b ? [[14, 12], [20, 15], [17, 17]] : [[11, 10], [15, 12], [13, 14]], m[2], 2);
    p.protect(b ? 7 : 5, b ? 9 : 7, b ? 18 : 14, b ? 14 : 11);
    p.anchor = b ? [16, 26] : [12, 20];
  },
  wrinkled_bottom_satchel(p) {
    const b = p.size === 32, m = MAT.leather;
    p.line(b ? [[7, 11], [4, 7], [6, 4], [12, 5]] : [[5, 8], [2, 5], [4, 2], [9, 3]], m[2], 2);
    p.poly(b ? [[6, 9], [23, 8], [28, 13], [26, 25], [20, 29], [7, 27], [3, 20]] : [[5, 7], [17, 6], [21, 10], [20, 19], [15, 22], [5, 20], [2, 15]], m[0]);
    p.poly(b ? [[6, 10], [23, 10], [25, 17], [20, 22], [7, 20], [4, 16]] : [[5, 8], [17, 8], [19, 13], [15, 17], [5, 15], [3, 12]], m[1]);
    p.poly(b ? [[6, 10], [22, 9], [26, 13], [19, 16], [7, 15]] : [[5, 8], [16, 7], [19, 10], [14, 12], [6, 11]], m[2]);
    p.line(b ? [[7, 22], [11, 24], [15, 22], [18, 25], [23, 22], [24, 25], [19, 27], [13, 25], [9, 26]] : [[5, 17], [8, 18], [11, 16], [13, 19], [17, 17], [18, 19], [14, 20], [10, 19], [7, 20]], m[2]);
    p.rect(b ? 14 : 11, b ? 13 : 10, 3, 5, MAT.brass[1]);
    p.dot(b ? 15 : 12, b ? 14 : 11, MAT.brass[3]);
    p.protect(b ? 6 : 5, b ? 9 : 7, b ? 19 : 14, b ? 11 : 8);
    p.anchor = b ? [15, 26] : [12, 20];
  },
  reverse_woven_basket(p) {
    const b = p.size === 32, m = MAT.wood;
    p.line(b ? [[9, 15], [8, 7], [12, 3], [18, 3], [23, 9], [22, 15]] : [[6, 11], [6, 6], [9, 2], [13, 2], [17, 7], [16, 11]], m[1], 2);
    p.line(b ? [[10, 8], [13, 5], [17, 5], [20, 9]] : [[8, 6], [10, 4], [12, 4], [15, 7]], m[3]);
    p.poly(b ? [[4, 14], [10, 11], [24, 12], [28, 17], [25, 26], [20, 29], [9, 27], [5, 23]] : [[3, 11], [8, 8], [18, 9], [21, 13], [19, 20], [15, 22], [7, 20], [4, 17]], m[1]);
    p.ellipse(b ? 5 : 4, b ? 12 : 9, b ? 23 : 17, b ? 9 : 7, m[0]);
    p.ellipse(b ? 7 : 6, b ? 13 : 10, b ? 18 : 12, b ? 5 : 4, MAT.ink);
    p.line(b ? [[5, 17], [10, 20], [23, 20], [27, 17]] : [[4, 13], [8, 15], [17, 15], [20, 13]], m[3]);
    p.line(b ? [[7, 21], [12, 24], [24, 22], [23, 25], [15, 27], [10, 25]] : [[5, 16], [9, 18], [18, 16], [17, 19], [11, 20], [7, 18]], m[2]);
    p.line(b ? [[10, 21], [12, 26], [17, 21], [19, 27], [24, 21]] : [[8, 16], [9, 20], [12, 16], [14, 20], [17, 16]], m[0]);
    p.protect(b ? 7 : 6, b ? 12 : 9, b ? 18 : 12, b ? 7 : 6);
    p.anchor = b ? [16, 27] : [12, 20];
  },
  clouded_lens(p) {
    const b = p.size === 32, m = MAT.glass;
    p.ellipse(b ? 5 : 4, b ? 5 : 4, b ? 22 : 16, b ? 22 : 16, m[0]);
    p.ellipse(b ? 6 : 5, b ? 6 : 5, b ? 18 : 13, b ? 18 : 13, m[1]);
    p.poly(b ? [[22, 4], [26, 5], [26, 14], [22, 13], [18, 9]] : [[17, 3], [20, 4], [20, 11], [17, 10], [14, 7]]);
    p.poly(b ? [[8, 11], [14, 7], [18, 12], [17, 18], [10, 19], [7, 16]] : [[6, 9], [10, 5], [13, 9], [12, 14], [7, 14], [5, 12]], MAT.bone[1]);
    p.line(b ? [[7, 13], [9, 9], [13, 7]] : [[5, 10], [7, 7], [10, 5]], m[3]);
    p.line(b ? [[12, 23], [18, 23], [23, 18]] : [[9, 17], [13, 17], [17, 14]], m[2]);
    p.protect(b ? 6 : 5, b ? 5 : 4, b ? 20 : 15, b ? 15 : 11);
    p.anchor = b ? [15, 25] : [11, 18];
  },
  ceramic_capsule(p) {
    const b = p.size === 32, m = MAT.ceramic, o = MAT.bone;
    p.poly(b ? [[3, 12], [8, 7], [23, 8], [28, 14], [27, 21], [20, 26], [7, 24], [3, 19]] : [[2, 9], [6, 5], [17, 6], [21, 10], [20, 16], [15, 20], [5, 18], [2, 14]], m[0]);
    p.poly(b ? [[4, 12], [8, 8], [16, 9], [15, 21], [7, 22], [4, 18]] : [[3, 9], [6, 6], [12, 7], [11, 16], [5, 16], [3, 13]], m[2]);
    p.poly(b ? [[17, 9], [23, 10], [26, 15], [25, 20], [20, 24], [16, 22]] : [[13, 7], [17, 8], [19, 11], [18, 15], [15, 18], [12, 16]], o[1]);
    p.line(b ? [[7, 10], [12, 9]] : [[5, 8], [9, 7]], m[3]);
    p.line(b ? [[20, 11], [24, 14], [24, 17]] : [[15, 9], [18, 11], [18, 13]], o[3]);
    p.protect(b ? 13 : 10, b ? 8 : 6, 5, b ? 16 : 12);
    p.anchor = b ? [15, 23] : [11, 18];
  },
  hollow_reed_joint(p) {
    const b = p.size === 32, m = MAT.wood;
    p.poly(b ? [[6, 5], [12, 3], [27, 22], [25, 28], [19, 29], [4, 11]] : [[5, 4], [9, 2], [21, 17], [19, 22], [14, 22], [3, 8]], m[1]);
    p.poly(b ? [[6, 6], [10, 5], [23, 22], [20, 25], [6, 10]] : [[5, 5], [8, 4], [18, 17], [15, 19], [4, 7]], m[2]);
    p.ellipse(b ? 18 : 13, b ? 21 : 16, b ? 10 : 8, b ? 8 : 6, m[0]);
    p.ellipse(b ? 20 : 15, b ? 23 : 18, b ? 6 : 4, b ? 4 : 3);
    p.line(b ? [[10, 15], [15, 11], [17, 13], [12, 17]] : [[7, 11], [11, 8], [13, 10], [9, 13]], m[0]);
    p.line(b ? [[7, 7], [12, 12]] : [[5, 5], [9, 10]], m[3]);
    p.protect(b ? 18 : 13, b ? 20 : 15, b ? 10 : 8, b ? 9 : 8);
    p.anchor = b ? [21, 26] : [16, 20];
  },
  sunken_inkstone(p) {
    const b = p.size === 32, m = MAT.plum;
    p.poly(b ? [[6, 5], [24, 8], [27, 24], [22, 29], [6, 26], [3, 19]] : [[5, 4], [18, 6], [21, 18], [17, 22], [5, 20], [2, 14]], m[0]);
    p.poly(b ? [[7, 6], [22, 9], [24, 22], [20, 25], [6, 22], [5, 17]] : [[6, 5], [16, 7], [18, 17], [15, 19], [5, 17], [4, 13]], m[2]);
    p.poly(b ? [[10, 11], [19, 11], [21, 20], [15, 22], [9, 20]] : [[8, 8], [14, 9], [16, 15], [11, 17], [7, 15]], m[1]);
    p.poly(b ? [[10, 16], [15, 19], [20, 17], [20, 20], [15, 22], [10, 20]] : [[8, 12], [11, 14], [15, 13], [15, 15], [11, 17], [8, 15]], MAT.ink);
    p.line(b ? [[7, 6], [18, 8], [21, 9]] : [[6, 5], [13, 6], [16, 7]], m[3]);
    p.protect(b ? 9 : 7, b ? 10 : 8, b ? 13 : 10, b ? 13 : 10);
    p.anchor = b ? [15, 26] : [12, 20];
  },
  hollow_eyelet(p) {
    const b = p.size === 32, m = MAT.brass;
    p.poly(b ? [[5, 17], [11, 18], [14, 28], [8, 28], [3, 23]] : [[4, 13], [8, 14], [10, 21], [6, 21], [2, 17]], MAT.leather[1]);
    p.ellipse(b ? 6 : 5, b ? 4 : 3, b ? 21 : 16, b ? 23 : 18, m[1]);
    p.ellipse(b ? 10 : 8, b ? 8 : 6, b ? 13 : 10, b ? 15 : 12);
    p.poly(b ? [[23, 16], [29, 19], [27, 24], [21, 20]] : [[17, 12], [22, 15], [20, 19], [15, 15]]);
    p.line(b ? [[8, 12], [11, 7], [17, 5], [22, 8]] : [[6, 9], [9, 5], [13, 4], [17, 6]], m[3]);
    p.line(b ? [[9, 20], [12, 23], [17, 24]] : [[7, 15], [9, 18], [13, 19]], m[2]);
    p.protect(b ? 10 : 8, b ? 8 : 6, b ? 14 : 10, b ? 16 : 12);
    p.anchor = b ? [12, 25] : [9, 19];
  },
  ash_tooth(p) {
    const b = p.size === 32, m = MAT.bone;
    p.poly(b ? [[8, 5], [17, 3], [24, 7], [25, 14], [20, 22], [15, 29], [11, 23], [5, 13]] : [[6, 4], [13, 2], [18, 5], [19, 10], [15, 17], [11, 22], [8, 17], [4, 9]], m[1]);
    p.poly(b ? [[9, 7], [16, 5], [20, 8], [19, 16], [15, 25], [12, 20], [7, 12]] : [[7, 5], [12, 4], [15, 6], [14, 12], [11, 19], [9, 15], [5, 9]], m[2]);
    p.poly(b ? [[17, 4], [23, 8], [23, 14], [19, 21], [16, 20], [19, 13]] : [[13, 3], [18, 6], [17, 10], [14, 16], [12, 15], [14, 10]], MAT.ceramic[1]);
    p.ellipse(b ? 9 : 7, b ? 6 : 5, b ? 7 : 5, b ? 5 : 4, MAT.ink);
    p.line(b ? [[10, 12], [13, 17], [14, 23]] : [[8, 9], [10, 13], [10, 17]], m[3]);
    p.protect(b ? 8 : 6, b ? 5 : 4, b ? 10 : 8, b ? 8 : 6);
    p.anchor = b ? [15, 25] : [11, 19];
  },
  creased_ticket_wallet(p) {
    const b = p.size === 32, m = MAT.leather, o = MAT.paper;
    p.poly(b ? [[4, 7], [16, 10], [27, 5], [28, 22], [17, 27], [5, 24]] : [[3, 5], [12, 7], [20, 4], [21, 17], [13, 21], [4, 18]], m[0]);
    p.poly(b ? [[6, 9], [14, 12], [15, 24], [6, 21]] : [[5, 7], [10, 9], [11, 18], [5, 16]], o[1]);
    p.poly(b ? [[17, 12], [25, 8], [26, 20], [18, 24]] : [[13, 9], [18, 6], [19, 15], [14, 18]], o[2]);
    p.line(b ? [[8, 12], [12, 13], [13, 21]] : [[6, 9], [9, 10], [10, 16]], o[0]);
    p.line(b ? [[18, 16], [23, 14], [23, 19], [19, 21]] : [[14, 12], [17, 10], [17, 14], [15, 16]], o[0]);
    p.poly(b ? [[25, 6], [28, 7], [27, 12], [23, 10]] : [[18, 5], [21, 5], [20, 9], [17, 8]], m[2]);
    p.protect(b ? 7 : 5, b ? 9 : 7, b ? 18 : 14, b ? 15 : 12);
    p.anchor = b ? [16, 25] : [12, 19];
  },
  paper_spiral(p) {
    const b = p.size === 32, m = MAT.paper;
    p.poly(b ? [[4, 8], [19, 4], [27, 11], [26, 25], [9, 28], [4, 22]] : [[3, 6], [14, 3], [21, 8], [20, 19], [7, 22], [3, 17]], m[0]);
    p.poly(b ? [[6, 9], [18, 6], [24, 11], [23, 23], [9, 25], [6, 21]] : [[5, 7], [13, 5], [18, 8], [17, 17], [7, 19], [5, 16]], m[2]);
    p.poly(b ? [[10, 12], [17, 9], [21, 13], [20, 21], [12, 22], [9, 18]] : [[8, 9], [12, 7], [15, 10], [14, 16], [9, 17], [7, 13]], m[0]);
    p.poly(b ? [[12, 13], [17, 12], [18, 17], [15, 20], [12, 18], [15, 17], [15, 15], [12, 15]] : [[9, 10], [12, 10], [13, 13], [11, 15], [9, 14], [11, 13], [11, 12], [9, 12]], m[1]);
    p.poly(b ? [[4, 19], [9, 21], [13, 26], [8, 29], [3, 25]] : [[3, 15], [6, 16], [10, 20], [6, 22], [2, 19]], m[1]);
    p.poly(b ? [[4, 19], [9, 21], [10, 25], [5, 24]] : [[3, 15], [6, 16], [7, 19], [3, 18]], m[3]);
    p.line(b ? [[6, 9], [17, 6], [23, 11], [22, 22]] : [[5, 7], [13, 5], [17, 9], [16, 17]], m[3]);
    p.protect(b ? 9 : 7, b ? 10 : 8, b ? 12 : 9, b ? 13 : 10);
    p.anchor = b ? [16, 25] : [12, 19];
  }
};

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/art/contaminant-catalog-icons-shells.ts
var CATALOG_SHELLS = {
  wax_parcel(p) {
    const b = p.size === 32, m = MAT.wax;
    p.poly(b ? [[7, 6], [22, 5], [27, 12], [25, 24], [15, 28], [5, 23], [3, 13]] : [[5, 5], [16, 4], [21, 9], [19, 18], [11, 21], [4, 17], [2, 10]], m[1]);
    p.poly(b ? [[7, 6], [22, 5], [24, 11], [14, 16], [4, 13]] : [[5, 5], [16, 4], [18, 8], [10, 12], [3, 10]], m[2]);
    p.poly(b ? [[14, 16], [25, 12], [24, 24], [15, 27]] : [[10, 12], [19, 9], [18, 18], [11, 20]], m[0]);
    p.line(b ? [[8, 7], [13, 9], [12, 13], [16, 18], [14, 24]] : [[6, 6], [10, 8], [9, 10], [12, 14], [10, 18]], m[0], 2);
    p.line(b ? [[8, 7], [12, 9], [11, 13], [15, 18]] : [[6, 6], [9, 8], [8, 10], [11, 14]], m[3]);
    p.line(b ? [[7, 20], [10, 23], [12, 23]] : [[5, 15], [7, 17], [9, 17]], m[2]);
    p.anchor = b ? [15, 26] : [11, 19];
  },
  resin_nodule(p) {
    const b = p.size === 32, m = MAT.amber;
    p.poly(b ? [[5, 12], [10, 5], [18, 4], [27, 13], [25, 22], [17, 27], [8, 26], [3, 19]] : [[4, 9], [8, 4], [14, 3], [21, 10], [19, 17], [13, 21], [6, 20], [2, 14]], m[0]);
    p.poly(b ? [[5, 12], [10, 6], [18, 5], [23, 11], [20, 18], [9, 19]] : [[4, 9], [8, 5], [14, 4], [18, 9], [15, 14], [7, 14]], m[1]);
    p.poly(b ? [[8, 10], [12, 6], [17, 6], [20, 10], [14, 12]] : [[6, 8], [9, 5], [13, 5], [15, 8], [10, 10]], m[2]);
    p.poly(b ? [[7, 21], [14, 20], [20, 23], [16, 26], [9, 25]] : [[5, 16], [11, 15], [16, 18], [12, 20], [7, 19]], m[2]);
    p.line(b ? [[11, 7], [16, 7], [18, 9]] : [[8, 6], [12, 6], [14, 8]], m[3]);
    p.line(b ? [[20, 14], [23, 16], [22, 19]] : [[16, 11], [18, 13], [17, 15]], m[1]);
    p.anchor = b ? [15, 25] : [11, 19];
  },
  ash_cocoon(p) {
    const b = p.size === 32, m = MAT.cloth;
    const x = b ? 5 : 4, y = b ? 7 : 6, w = b ? 23 : 17, h = b ? 20 : 15;
    p.ellipse(x, y, w, h, m[0]);
    p.ellipse(x + 1, y, w - 3, h - 3, m[1]);
    p.poly(b ? [[7, 12], [13, 7], [23, 10], [20, 14], [9, 18]] : [[5, 10], [10, 6], [18, 8], [15, 11], [6, 14]], m[2]);
    p.line(b ? [[8, 19], [15, 15], [21, 17], [24, 22]] : [[6, 15], [11, 11], [16, 13], [18, 17]], m[0], 2);
    p.line(b ? [[9, 20], [16, 17], [21, 19]] : [[7, 16], [12, 13], [16, 15]], m[2]);
    p.line(b ? [[10, 11], [14, 9], [18, 10]] : [[7, 9], [11, 7], [14, 8]], m[3]);
    p.anchor = b ? [16, 25] : [12, 19];
  },
  layered_hide(p) {
    const b = p.size === 32, m = MAT.leather;
    p.poly(b ? [[4, 12], [12, 7], [26, 11], [28, 20], [21, 26], [5, 23]] : [[3, 9], [9, 5], [19, 8], [21, 15], [16, 20], [4, 18]], m[0]);
    p.poly(b ? [[5, 11], [12, 7], [25, 11], [23, 18], [9, 21], [4, 18]] : [[4, 8], [9, 5], [19, 8], [17, 13], [7, 16], [3, 13]], m[1]);
    p.poly(b ? [[5, 12], [12, 8], [24, 11], [15, 15], [8, 15]] : [[4, 9], [9, 6], [18, 8], [11, 11], [6, 11]], m[2]);
    p.line(b ? [[7, 18], [16, 20], [23, 16]] : [[5, 14], [12, 16], [18, 12]], m[3]);
    p.poly(b ? [[21, 12], [26, 13], [23, 18], [20, 17]] : [[16, 9], [20, 10], [17, 14], [15, 13]], m[0]);
    p.anchor = b ? [14, 23] : [11, 18];
  },
  ceramic_seal(p) {
    const b = p.size === 32, m = MAT.ceramic;
    p.poly(b ? [[8, 5], [24, 7], [27, 21], [22, 27], [7, 25], [4, 13]] : [[6, 4], [18, 5], [21, 16], [16, 21], [5, 19], [3, 10]], m[0]);
    p.poly(b ? [[8, 5], [24, 7], [23, 17], [8, 18], [5, 12]] : [[6, 4], [18, 5], [17, 13], [6, 14], [4, 9]], m[1]);
    p.poly(b ? [[8, 6], [23, 8], [20, 11], [7, 10]] : [[6, 5], [17, 6], [15, 9], [5, 8]], m[3]);
    p.line(b ? [[6, 15], [15, 16], [18, 13], [25, 14]] : [[4, 12], [11, 13], [14, 10], [19, 11]], m[0], 2);
    p.line(b ? [[8, 21], [18, 23], [23, 21]] : [[6, 17], [13, 18], [18, 16]], m[2]);
    p.anchor = b ? [16, 24] : [12, 19];
  },
  salt_case(p) {
    const b = p.size === 32, m = MAT.bone;
    p.poly(b ? [[3, 11], [23, 7], [29, 12], [27, 23], [7, 26], [3, 22]] : [[2, 9], [17, 5], [22, 9], [20, 17], [5, 20], [2, 16]], m[0]);
    p.poly(b ? [[4, 11], [23, 8], [27, 12], [9, 18], [4, 16]] : [[3, 9], [17, 6], [20, 9], [7, 14], [3, 12]], m[1]);
    p.poly(b ? [[9, 18], [27, 13], [26, 21], [9, 24]] : [[7, 14], [20, 10], [19, 16], [7, 18]], m[2]);
    p.line(b ? [[5, 12], [12, 11], [13, 9], [21, 9]] : [[4, 10], [9, 9], [10, 7], [15, 7]], m[3], 2);
    p.line(b ? [[5, 18], [9, 20], [10, 23]] : [[3, 14], [6, 16], [7, 18]], m[3]);
    p.anchor = b ? [15, 23] : [11, 17];
  },
  stitched_pouch(p) {
    const b = p.size === 32, m = MAT.plum;
    p.poly(b ? [[9, 4], [22, 7], [19, 11], [26, 18], [24, 26], [10, 28], [5, 23], [7, 13], [11, 10]] : [[7, 3], [17, 5], [14, 8], [20, 13], [18, 20], [8, 21], [4, 17], [5, 10], [8, 8]], m[0]);
    p.poly(b ? [[11, 10], [18, 10], [23, 18], [20, 25], [10, 26], [7, 21], [9, 15]] : [[8, 8], [14, 8], [18, 14], [15, 19], [8, 19], [5, 15], [7, 11]], m[1]);
    p.line(b ? [[10, 14], [9, 21], [12, 24]] : [[8, 11], [7, 16], [9, 18]], m[2], 2);
    p.line(b ? [[10, 5], [14, 8], [21, 8]] : [[8, 4], [11, 6], [16, 6]], MAT.paper[2]);
    for (const [x, y] of b ? [[15, 13], [17, 17], [17, 21]] : [[11, 10], [13, 13], [13, 16]]) p.rect(x, y, 2, 1, MAT.paper[2]);
    p.anchor = b ? [16, 26] : [12, 19];
  },
  thin_shell_ovoid(p) {
    const b = p.size === 32, m = MAT.bone;
    const x = b ? 7 : 5, y = b ? 4 : 3, w = b ? 18 : 15, h = b ? 24 : 19;
    p.ellipse(x, y, w, h, m[1]);
    p.ellipse(x + 1, y + 1, w - 5, h - 5, m[2]);
    p.poly(b ? [[20, 5], [24, 12], [23, 23], [19, 27], [18, 19], [20, 12]] : [[16, 4], [19, 9], [18, 18], [15, 21], [14, 14], [16, 9]], m[0]);
    p.line(b ? [[18, 5], [17, 11], [19, 16], [17, 24]] : [[14, 4], [13, 8], [15, 13], [13, 19]], m[3]);
    p.line(b ? [[10, 11], [12, 7], [15, 6]] : [[8, 9], [9, 6], [11, 5]], m[3]);
    p.anchor = b ? [16, 26] : [12, 20];
  }
};

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/art/contaminant-catalog-icons-ground.ts
var GROUND = {
  split_tongue_bell(p) {
    p.rect(7, 2, 2, 3, MAT.brass[2]);
    p.poly([[5, 5], [10, 5], [11, 9], [14, 12], [3, 13], [4, 9]], MAT.brass[1]);
    p.poly([[5, 6], [8, 5], [8, 10], [4, 11]], MAT.brass[2]);
    p.ellipse(3, 10, 11, 4, MAT.brass[0]);
    p.line([[3, 11], [6, 10], [12, 10]], MAT.brass[3]);
    p.rect(8, 10, 2, 3, MAT.iron[1]);
    p.dot(7, 13, MAT.iron[2]);
  },
  crooked_clay_whistle(p) {
    p.line([[5, 8], [3, 5], [4, 2]], MAT.ceramic[2], 2);
    p.poly([[5, 5], [10, 4], [14, 8], [13, 12], [7, 14], [3, 10]], MAT.leather[1]);
    p.poly([[6, 5], [10, 5], [12, 8], [8, 10], [4, 9]], MAT.ceramic[2]);
    p.ellipse(9, 9, 3, 3, MAT.ink);
    p.line([[5, 10], [7, 12], [10, 12]], MAT.leather[2]);
  },
  missing_tooth_music_box(p) {
    p.poly([[3, 3], [11, 2], [12, 6], [4, 7]], MAT.wood[2]);
    p.poly([[2, 8], [11, 6], [13, 9], [12, 13], [4, 14], [2, 12]], MAT.wood[0]);
    p.poly([[3, 8], [11, 7], [12, 10], [4, 11]], MAT.wood[1]);
    p.rect(5, 8, 6, 2, MAT.iron[0]);
    p.line([[5, 8], [6, 8]], MAT.iron[3]);
    p.line([[9, 8], [10, 8]], MAT.iron[2]);
    p.line([[12, 10], [14, 10], [14, 7]], MAT.brass[2]);
  },
  hollow_reed_joint(p) {
    p.poly([[3, 4], [6, 2], [13, 10], [11, 14], [8, 13]], MAT.wood[1]);
    p.line([[4, 4], [10, 11]], MAT.wood[3], 2);
    p.ellipse(8, 10, 5, 4, MAT.wood[0]);
    p.ellipse(9, 11, 3, 2);
    p.line([[5, 7], [7, 5]], MAT.wood[0]);
  },
  lead_type_stamp(p) {
    p.poly([[5, 3], [9, 2], [11, 5], [10, 8], [8, 8], [9, 5], [6, 5], [6, 8], [4, 8], [4, 5]], MAT.iron[2]);
    p.poly([[3, 8], [11, 7], [14, 10], [12, 14], [3, 13], [2, 10]], MAT.iron[0]);
    p.poly([[3, 8], [11, 8], [12, 10], [4, 11]], MAT.iron[2]);
    p.line([[4, 12], [8, 12], [10, 11]], MAT.iron[1]);
  },
  broken_eye_scale_weight(p) {
    p.line([[6, 5], [6, 2], [9, 2]], MAT.iron[2], 2);
    p.poly([[5, 5], [9, 5], [13, 11], [11, 14], [4, 14], [2, 10]], MAT.iron[0]);
    p.poly([[5, 6], [7, 5], [8, 12], [4, 12], [3, 10]], MAT.iron[2]);
    p.line([[9, 7], [11, 10], [10, 12]], MAT.iron[1]);
  },
  waterlogged_spine(p) {
    p.poly([[2, 7], [4, 3], [7, 4], [7, 7], [10, 6], [13, 8], [13, 12], [10, 14], [8, 12], [5, 12], [4, 10], [2, 11]], MAT.bone[0]);
    p.poly([[3, 6], [5, 4], [7, 5], [6, 8], [3, 8]], MAT.bone[2]);
    p.poly([[6, 9], [8, 7], [11, 8], [10, 11], [7, 12]], MAT.bone[2]);
    p.poly([[10, 10], [13, 9], [12, 12], [10, 13]], MAT.bone[1]);
    p.dot(5, 6, MAT.ink);
    p.rect(8, 9, 2, 1, MAT.ink);
  },
  sunken_inkstone(p) {
    p.poly([[3, 3], [12, 5], [13, 12], [5, 14], [2, 10]], MAT.plum[0]);
    p.poly([[4, 4], [11, 5], [11, 10], [5, 12], [3, 9]], MAT.plum[2]);
    p.poly([[5, 6], [10, 6], [9, 10], [5, 10]], MAT.ink);
    p.line([[4, 4], [9, 5]], MAT.plum[3]);
    p.line([[5, 12], [11, 10]], MAT.plum[1]);
  }
};
var CATALOG_GROUND_IDS = Object.freeze(Object.keys(GROUND));

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/art/contaminant-catalog-icons-world-faces.ts
var box = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
var facet = (material, light, shade) => ({ material, light, shade });
var FACES = {
  amber_beetle: [facet("amber", [[3, 5], [20, 3], [18, 12], [5, 19]], [[17, 17], [29, 12], [28, 29], [12, 29]])],
  stopped_pocket_watch: [facet("brass", box(3, 7, 10, 14), box(18, 13, 12, 16))],
  sealed_hourglass: [facet("wood", box(5, 4, 6, 22), box(19, 8, 8, 21))],
  brass_monocle: [facet("brass", box(3, 3, 13, 16), box(16, 13, 12, 16))],
  milky_fish_eye: [facet("bone", box(2, 4, 13, 16), [[19, 17], [30, 16], [26, 28], [9, 29], [9, 23]])],
  doorless_lantern: [facet("iron", box(7, 9, 6, 20), box(20, 12, 7, 18))],
  wax_sealed_button: [facet("wax", box(2, 4, 15, 15), [[19, 9], [29, 10], [28, 28], [5, 29], [6, 22], [19, 23]])],
  double_hole_token: [facet("iron", box(7, 2, 12, 8), box(17, 18, 8, 12))],
  split_tongue_bell: [facet("brass", [[7, 8], [17, 8], [14, 18], [6, 25]], box(19, 13, 10, 16))],
  crooked_clay_whistle: [facet("leather", [[4, 10], [20, 7], [21, 13], [11, 17], [8, 23], [3, 20]], box(20, 14, 9, 15))],
  missing_tooth_music_box: [facet("wood", box(3, 16, 8, 14), box(19, 19, 10, 11))],
  lead_type_stamp: [facet("iron", box(2, 13, 11, 14), box(20, 18, 9, 11))],
  broken_eye_scale_weight: [facet("iron", [[9, 8], [15, 8], [13, 21], [8, 25], [3, 24], [7, 15]], box(18, 17, 11, 12)), facet("iron", box(9, 2, 10, 7), box(24, 18, 5, 10))],
  waterlogged_spine: [facet("bone", box(3, 4, 12, 14), [[18, 14], [29, 20], [28, 30], [12, 30], [12, 22]])],
  silver_back_hand_mirror: [facet("iron", box(3, 3, 10, 21), box(18, 17, 10, 13))],
  empty_photo_frame: [facet("wood", box(4, 3, 6, 23), box(19, 10, 10, 19))],
  inverted_face_mask: [facet("bone", box(5, 3, 10, 16), [[21, 8], [28, 9], [25, 23], [18, 30], [9, 26], [13, 22]])],
  blind_needle_compass: [facet("brass", box(2, 12, 10, 16), box(20, 14, 10, 15))],
  creased_negative: [facet("leather", box(4, 3, 9, 20), box(17, 16, 12, 14))],
  one_eyed_puppet_head: [facet("wood", box(4, 3, 9, 22), box(21, 13, 8, 16))],
  cold_ash_pipe: [facet("wood", box(15, 9, 7, 20), box(23, 17, 7, 13))],
  ceramic_charcoal_box: [facet("ceramic", box(3, 13, 9, 17), box(21, 17, 10, 13))],
  frosted_furnace_core: [facet("iron", box(4, 4, 8, 22), box(19, 17, 9, 13))],
  sealed_flower_calyx: [facet("ceramic", [[3, 7], [9, 3], [15, 9], [13, 22], [6, 23]], box(20, 11, 10, 18))],
  split_porcelain_spoon: [facet("bone", box(9, 12, 7, 14), [[23, 12], [29, 18], [28, 29], [16, 30], [17, 24]])],
  salted_vial: [facet("glass", box(7, 10, 6, 19), box(20, 15, 8, 14))],
  bone_clasp_mask: [facet("cloth", box(4, 6, 10, 18), box(19, 11, 8, 16))],
  lead_fastened_breastplate: [facet("iron", box(5, 4, 8, 21), box(19, 15, 8, 13))],
  split_heel_boot: [facet("leather", box(5, 2, 10, 21), box(21, 18, 9, 12))],
  coiled_tape_measure: [facet("brass", box(2, 4, 11, 17), box(17, 16, 10, 12))],
  hollow_loom_shuttle: [facet("wood", [[1, 17], [10, 8], [23, 3], [20, 10], [7, 23]], box(17, 13, 12, 16))],
  gray_felt_glove: [facet("cloth", box(6, 2, 12, 22), box(18, 16, 11, 14))],
  scorched_scarf: [facet("plum", box(3, 2, 13, 23), box(18, 15, 9, 15))],
  unlined_coat: [facet("leather", box(4, 4, 9, 20), box(20, 11, 10, 18))],
  crooked_hook_needle: [facet("iron", box(8, 2, 14, 25), box(21, 3, 8, 11)), facet("paper", box(3, 10, 7, 13), box(12, 17, 10, 10))],
  wooden_thread_spool: [facet("wood", box(2, 5, 11, 24), box(20, 5, 10, 19))],
  double_clasp_strap: [facet("leather", box(4, 10, 8, 17), box(21, 10, 8, 17)), facet("brass", box(3, 2, 8, 11), box(23, 2, 8, 13))],
  brass_back_buckle: [facet("brass", box(2, 7, 12, 18), box(21, 11, 9, 16))],
  wrinkled_bottom_satchel: [facet("leather", box(2, 8, 12, 19), box(22, 12, 8, 16))],
  reverse_woven_basket: [facet("wood", box(3, 11, 9, 17), box(22, 16, 8, 14))],
  clouded_lens: [facet("glass", box(4, 4, 11, 21), box(19, 15, 10, 14))],
  ceramic_capsule: [facet("ceramic", box(2, 6, 10, 20), box(18, 16, 11, 12)), facet("bone", box(17, 7, 6, 10), box(21, 15, 8, 13))],
  hollow_reed_joint: [facet("wood", [[3, 4], [13, 2], [20, 12], [15, 17], [5, 13]], box(18, 19, 11, 11))],
  sunken_inkstone: [facet("plum", box(2, 3, 12, 24), box(21, 14, 8, 17))],
  hollow_eyelet: [facet("brass", box(5, 3, 12, 24), box(18, 14, 11, 15))],
  ash_tooth: [facet("bone", box(4, 3, 10, 21), [[18, 13], [27, 14], [20, 25], [15, 31], [9, 23]])],
  creased_ticket_wallet: [facet("leather", box(3, 6, 9, 20), box(22, 4, 8, 24))],
  paper_spiral: [facet("paper", box(3, 4, 9, 24), box(21, 12, 8, 17))],
  "shell:wax_parcel": [facet("wax", box(2, 4, 12, 20), [[21, 8], [29, 12], [27, 27], [14, 30], [11, 25], [20, 22]])],
  "shell:resin_nodule": [facet("amber", box(2, 3, 14, 21), box(19, 14, 10, 15))],
  "shell:ash_cocoon": [facet("cloth", box(4, 6, 12, 19), box(20, 14, 10, 15))],
  "shell:layered_hide": [facet("leather", box(3, 6, 12, 18), box(20, 11, 10, 17))],
  "shell:ceramic_seal": [facet("ceramic", box(3, 4, 11, 21), box(21, 13, 8, 16))],
  "shell:salt_case": [facet("bone", box(2, 8, 11, 17), box(22, 10, 8, 16))],
  "shell:stitched_pouch": [facet("plum", box(4, 9, 10, 18), box(21, 15, 7, 15))],
  "shell:thin_shell_ovoid": [facet("bone", box(6, 3, 11, 23), [[20, 5], [27, 10], [26, 26], [18, 30], [14, 25], [19, 19]])]
};

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/art/contaminant-catalog-icons.ts
var OBJECTS = { ...CATALOG_OBJECTS, ...SECONDARY_OBJECTS };
var CATALOG_ART_ITEM_IDS = Object.freeze(Object.keys(OBJECTS));
var CATALOG_ART_APPEARANCE_IDS = Object.freeze(Object.keys(CATALOG_SHELLS));

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/systems/tool-ground-vfx.ts
var objects = /* @__PURE__ */ new Map();
function drawToolObject(g, type, p, alpha) {
  let pixels = objects.get(type);
  if (!pixels) {
    pixels = [];
    const source = contaminantWorldPixels(type);
    for (let y = 0; y < source.height; y += 2) for (let x = 0; x < source.width; x += 2) {
      const i = (y * source.width + x) * 4;
      if (source.data[i + 3]) pixels.push({
        x: x / 2 - 8,
        y: y / 2 - 8,
        color: source.data[i] * 65536 + source.data[i + 1] * 256 + source.data[i + 2]
      });
    }
    objects.set(type, pixels);
  }
  for (const pixel of pixels) g.fillStyle(pixel.color, alpha).fillRect(Math.round(p.x) + pixel.x, Math.round(p.y) + pixel.y, 1, 1);
}
function drawPressure(g, p, radius, alpha, drawObject = true) {
  g.clear();
  for (let i = 0; i < 13; i++) {
    const angle = i * 2.39996;
    for (let step = 0; step < 7 + i % 4; step++) {
      const a = angle + step / radius;
      const r = radius - 2 - (step % 4 === 0 ? 1 : 0);
      const x = Math.round(p.x + Math.cos(a) * r), y = Math.round(p.y + Math.sin(a) * r);
      g.fillStyle(1055512, alpha * 0.8).fillRect(x - 1, y + 1, 3, 2);
      g.fillStyle(i % 3 ? 9015937 : 11642762, alpha * 0.72).fillRect(x, y, 2, 1);
    }
  }
  for (let i = 0; i < 37; i++) {
    const angle = i * 2.39996, r = radius * (i % 4 === 0 ? 0.96 : 0.23 + i * 13 % 19 / 28);
    const x = Math.round(p.x + Math.cos(angle) * r), y = Math.round(p.y + Math.sin(angle) * r);
    g.fillStyle(i % 3 ? 5792347 : 9079669, alpha * (i % 4 ? 0.32 : 0.48));
    g.fillRect(x, y, 2 + i % 4, 1);
    if (i % 4 === 0) g.fillRect(x + 2, y + 1, 2, 1);
  }
  if (drawObject) drawToolObject(g, "compress", p, alpha);
}
function drawFootDrag(g, p, alpha) {
  const x = Math.round(p.x), y = Math.round(p.y);
  g.fillStyle(11183500, alpha * 0.65);
  g.fillRect(x - 6, y + 2, 4, 1);
  g.fillRect(x + 1, y + 3, 6, 1);
  g.fillStyle(5467747, alpha * 0.6);
  g.fillRect(x - 4, y + 3, 2, 1);
  g.fillRect(x + 4, y + 4, 2, 1);
}
function drawSeam(g, a, b, alpha, tension = 0) {
  g.clear();
  const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length, ny = dx / length;
  for (let i = 0; i <= Math.ceil(length); i++) {
    const t = i / Math.ceil(length);
    const bow = Math.sin(t * Math.PI) * (Math.sin(i * 0.47) + 1.3) * (1 - tension);
    const x = Math.round(a.x + dx * t + nx * bow), y = Math.round(a.y + dy * t + ny * bow);
    g.fillStyle(i % 7 < 2 ? 8558215 : 5859422, alpha * (0.7 + tension * 0.25));
    g.fillRect(x, y, 1, 1);
    if (i * 7 % 23 < 2) {
      g.fillStyle(10065021, alpha * 0.55);
      g.fillRect(Math.round(x + nx * 2), Math.round(y + ny * 2), 1 + i % 2, 1);
    }
  }
  for (const p of [a, b]) {
    g.fillStyle(3423542, alpha);
    g.fillRect(Math.round(p.x) - 3, Math.round(p.y), 5, 2);
    g.fillStyle(10130297, alpha * 0.8);
    g.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 1, 3, 1);
  }
}
function drawHostRestraint(g, p, held, remaining, elapsed) {
  g.clear();
  if (held) {
    const release = Math.max(0, -remaining / 450);
    const alpha2 = 1 - Math.min(1, release);
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? -1 : 1;
      const x = Math.round(p.x + side * (10 + i * 7 % 20));
      const y = Math.round(p.y - 32 + i * 13 % 53 + release * release * (20 + i % 9));
      g.fillStyle(1320223, alpha2 * 0.8).fillRect(x - 1, y - 1, 4, 4);
      g.fillStyle(i % 4 ? 11905417 : 8760473, alpha2 * 0.9).fillRect(x, y, i % 3 ? 2 : 3, 2);
      if (i % 4 === 0) g.fillRect(x + 1, y - 3, 1, 2);
    }
    return;
  }
  const alpha = Math.min(1, remaining / 350);
  for (let i = 0; i < 15; i++) {
    const side = i % 2 ? -1 : 1;
    const x = Math.round(p.x + side * (7 + i * 7 % 9));
    const drift = held ? 0 : Math.floor((elapsed * 6e-3 + i * 3) % 8);
    const y = Math.round(p.y - 19 + i * 11 % 26 + drift);
    g.fillStyle(held ? i % 3 ? 10129781 : 7113597 : i % 3 ? 6842720 : 9209719, alpha * 0.7);
    g.fillRect(x, y, i % 3 === 0 ? 2 : 1, held ? 2 : 1);
  }
}

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/systems/tool-vfx.ts
var CONTAM_GLOW = 2811592;
var GHOST_COLOR = 5922662;
var BRACKET_SIZE = 6;
var BRACKET_LEG = 2;
function drawBracketMarker(g, pos, color, alpha) {
  const h = BRACKET_SIZE / 2;
  g.lineStyle(1, color, alpha);
  g.beginPath();
  g.moveTo(pos.x - h, pos.y - h + BRACKET_LEG);
  g.lineTo(pos.x - h, pos.y - h);
  g.lineTo(pos.x - h + BRACKET_LEG, pos.y - h);
  g.strokePath();
  g.beginPath();
  g.moveTo(pos.x + h - BRACKET_LEG, pos.y - h);
  g.lineTo(pos.x + h, pos.y - h);
  g.lineTo(pos.x + h, pos.y - h + BRACKET_LEG);
  g.strokePath();
  g.beginPath();
  g.moveTo(pos.x - h, pos.y + h - BRACKET_LEG);
  g.lineTo(pos.x - h, pos.y + h);
  g.lineTo(pos.x - h + BRACKET_LEG, pos.y + h);
  g.strokePath();
  g.beginPath();
  g.moveTo(pos.x + h - BRACKET_LEG, pos.y + h);
  g.lineTo(pos.x + h, pos.y + h);
  g.lineTo(pos.x + h, pos.y + h - BRACKET_LEG);
  g.strokePath();
}

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/systems/catalog-ability-runtime.ts
var textId = (value) => typeof value === "string" && value.length > 0 && value.length <= 256;
var points = (value) => Array.isArray(value) && value.length <= 4096 && value.every(runtimeVector);
function validateCatalogAbilityRuntimeState(value) {
  if (!runtimeRecord(value) || value.version !== 1 || typeof value.runId !== "string" || !runtimeNumber(value.elapsedMs, 0) || !runtimeInteger(value.serial, 0) || !runtimeStrings(value.completedActions, 16384) || value.completedActions.length !== value.serial || !runtimeNumber(value.dashCooldownMs, 0, 400) || !Array.isArray(value.effects) || value.effects.length > 10) return false;
  if (value.controlRejections !== void 0 && (!Array.isArray(value.controlRejections) || value.controlRejections.length > 4096 || !value.controlRejections.every((row) => runtimeRecord(row) && textId(row.enemyId) && runtimeNumber(row.remainingMs, Number.MIN_VALUE, 350)) || new Set(value.controlRejections.map((row) => row.enemyId)).size !== value.controlRejections.length)) return false;
  const ids = /* @__PURE__ */ new Set(), families = /* @__PURE__ */ new Set();
  for (const effect of value.effects) {
    if (!runtimeRecord(effect) || !validateResolvedCatalogAbility(effect.resolvedParams)) return false;
    const params = effect.resolvedParams;
    if (params.slot !== "active" || families.has(params.familyId) || !textId(effect.effectId) || !/^ability:[1-9][0-9]*$/.test(effect.effectId) || Number(effect.effectId.slice(8)) > value.serial || ids.has(effect.effectId) || !textId(effect.actionId) || !value.completedActions.includes(effect.actionId) || !textId(effect.sourceInstanceId) || effect.definitionId !== params.definitionId || effect.catalogVersion !== params.catalogVersion || !runtimeNumber(effect.startTime, 0, value.elapsedMs) || !runtimeNumber(effect.remainingTime, 0, params.durationMs) || Math.abs(effect.remainingTime - Math.max(0, params.durationMs - (value.elapsedMs - effect.startTime))) > 1e-3 || !runtimeVector(effect.position) || !runtimeVector(effect.origin) || typeof effect.controlActive !== "boolean" || !(effect.targetId === null || textId(effect.targetId)) || !runtimeNumber(effect.pulseElapsedMs, 0, 1e3) || !runtimeStrings(effect.affectedEnemyIds, 4096) || !Array.isArray(effect.previousPositions) || effect.previousPositions.length > 4096 || !effect.previousPositions.every((row) => runtimeRecord(row) && textId(row.enemyId) && runtimeVector(row.position)) || new Set(effect.previousPositions.map((row) => row.enemyId)).size !== effect.previousPositions.length || !Array.isArray(effect.stops) || effect.stops.length > 4096 || !effect.stops.every((row) => runtimeRecord(row) && textId(row.enemyId) && effect.affectedEnemyIds.includes(row.enemyId) && runtimeNumber(row.remainingMs, Number.MIN_VALUE, params.familyId === "tripwire" ? params.paramValue : 0)) || new Set(effect.stops.map((row) => row.enemyId)).size !== effect.stops.length || !(effect.echo === null || validateBodyEchoRuntimeState(effect.echo))) return false;
    if (params.familyId === "solidify" || params.familyId === "suppress") {
      if (!textId(effect.targetId)) return false;
    } else if (effect.targetId !== null) return false;
    if (params.familyId === "tripwire") {
      if (!runtimeRecord(effect.line) || !runtimeVector(effect.line.pointA) || !runtimeVector(effect.line.pointB) || Math.abs(Math.hypot(effect.line.pointA.x - effect.line.pointB.x, effect.line.pointA.y - effect.line.pointB.y) - 64) > 1e-3) return false;
    } else if (effect.line !== null || effect.stops.length || effect.previousPositions.length) return false;
    if (params.familyId === "survey") {
      const snapshot = effect.snapshot;
      if (!runtimeRecord(snapshot) || !points(snapshot.enemyPositions) || !points(snapshot.nodePositions) || snapshot.corePositions !== void 0 && !points(snapshot.corePositions)) return false;
    } else if (effect.snapshot !== null) return false;
    if (effect.remainingTime === 0 && !effect.stops.length) return false;
    ids.add(effect.effectId);
    families.add(params.familyId);
  }
  return true;
}
var CatalogAbilityRuntime = class {
  constructor(scene2, player, enemies, ports) {
    this.scene = scene2;
    this.player = player;
    this.enemies = enemies;
    this.ports = ports;
  }
  elapsedMs = 0;
  serial = 0;
  completedActions = [];
  effects = [];
  dashCooldownMs = 0;
  graphics = /* @__PURE__ */ new Map();
  echoes = /* @__PURE__ */ new Map();
  failure = null;
  controlRejections = /* @__PURE__ */ new Map();
  rejectionGraphic = null;
  getLastFailure() {
    return this.failure;
  }
  showControlRejection(enemyId) {
    const enemy = this.enemies().find((row) => row.getId() === enemyId);
    if (!enemy || !(this.ports.isTargetVisible?.(enemy.getPosition()) ?? true)) return;
    this.controlRejections.set(enemyId, 350);
    this.drawControlRejections();
  }
  showNearestControlRejection(range = Infinity) {
    const enemy = this.pick(this.enemies(), range, (row) => row.getPosition(), (row) => (this.ports.isTargetAlive?.(row.getId()) ?? true) && !(this.ports.canApplyHardControl?.(row.getId()) ?? true));
    if (enemy) this.showControlRejection(enemy.getId());
  }
  isFamilyActive(family) {
    return this.effects.some((effect) => effect.resolvedParams.familyId === family);
  }
  isActionSilenced() {
    return this.isFamilyActive("silence");
  }
  isGroundDashing() {
    return this.isFamilyActive("dash");
  }
  getResistanceBonus() {
    return this.effects.find((effect) => effect.resolvedParams.familyId === "resistance")?.resolvedParams.paramValue ?? 0;
  }
  getActiveEffects() {
    return this.effects.map((effect) => ({
      definitionId: effect.definitionId,
      familyId: effect.resolvedParams.familyId,
      remainingMs: effect.remainingTime,
      durationMs: effect.resolvedParams.durationMs,
      ...effect.resolvedParams.familyId === "resistance" ? { resistanceBonus: effect.resolvedParams.paramValue } : {}
    }));
  }
  getRestraint(id) {
    return {
      pressure: this.effects.some((effect) => effect.resolvedParams.familyId === "slow_zone" && effect.affectedEnemyIds.includes(id)),
      snared: this.effects.some((effect) => effect.stops.some((stop) => stop.enemyId === id))
    };
  }
  /** Shared read-only admission for visible aiming and the real one-press action. */
  getTargetPreview(ability) {
    if (ability.slot !== "active" || this.isFamilyActive(ability.familyId) || this.ports.hasEquivalentLegacyEffect?.(ability.familyId)) return null;
    const origin = this.player(), family = ability.familyId;
    if (family === "solidify") {
      const enemy = this.pick(this.enemies(), ability.rangePx, (row) => row.getPosition(), (row) => (this.ports.isTargetAlive?.(row.getId()) ?? true) && (this.ports.canApplyHardControl?.(row.getId()) ?? true));
      return enemy && this.ports.setEnemyControl ? { kind: "target", origin, position: enemy.getPosition(), targetId: enemy.getId() } : null;
    }
    if (family === "suppress") {
      const target = this.pick(this.ports.getEnvironmentTargets?.() ?? [], ability.rangePx, (row) => row.position, (row) => row.canSuppressCatalogHazard ?? row.canSuppressHazard);
      return target && this.ports.suppressEnvironmentHazard ? { kind: "target", origin, position: target.position, targetId: target.id } : null;
    }
    if (family === "dash") {
      if (this.dashCooldownMs > 0 || !this.ports.advanceGroundDash) return null;
      const destination = this.ports.getDashDestination?.(ability.paramValue);
      return destination && Math.hypot(destination.x - origin.x, destination.y - origin.y) >= 16 ? { kind: "dash", origin, position: destination } : null;
    }
    if (family === "sound_lure") {
      const position = this.ports.getSoundLureDestination?.(ability.rangePx);
      return position && this.ports.reportSoundLure && (this.ports.isTargetVisible?.(position) ?? true) ? { kind: "point", origin, position } : null;
    }
    if (family === "tripwire") {
      const line = this.ports.getStitchPlacement?.(64, ability.rangePx);
      return line && this.ports.setEnemyControl ? {
        kind: "line",
        origin,
        line,
        position: { x: (line.pointA.x + line.pointB.x) / 2, y: (line.pointA.y + line.pointB.y) / 2 }
      } : null;
    }
    if (family === "slow_zone" && this.ports.setEnemyControl && this.ports.isGroundConnected?.(origin, origin, ability.rangePx)) {
      return { kind: "area", origin, position: origin, radius: ability.rangePx };
    }
    return null;
  }
  use(ability, sourceInstanceId, commit, requestedActionId) {
    this.failure = null;
    if (!validateResolvedCatalogAbility(ability) || ability.slot !== "active") return false;
    const actionId = requestedActionId ?? `catalog:${this.ports.runId ?? ""}:${this.serial + 1}`;
    if (!textId(actionId) || this.completedActions.includes(actionId)) return false;
    const family = ability.familyId;
    if (this.isFamilyActive(family) || this.ports.hasEquivalentLegacyEffect?.(family)) return this.fail("\u540C\u7C7B\u6548\u679C\u5C1A\u672A\u7ED3\u675F\uFF0C\u672A\u6D88\u8017\u6B21\u6570\u3002");
    let targetId = null, line = null, snapshot = null;
    const origin = { ...this.player() };
    let position = { ...origin };
    const preview = this.getTargetPreview(ability);
    if (family === "solidify") {
      if (!preview?.targetId) {
        this.showNearestControlRejection(ability.rangePx);
        return this.fail("\u9762\u524D\u6CA1\u6709\u53EF\u51DD\u6EDE\u7684\u53EF\u89C1\u76EE\u6807\uFF1B\u521A\u6323\u8131\u7684\u5BF9\u8C61\u6682\u65F6\u4E0D\u80FD\u518D\u63A7\u5236\u3002");
      }
      targetId = preview.targetId;
      position = { ...preview.position };
    } else if (family === "suppress") {
      if (!preview?.targetId) return this.fail("\u9762\u524D\u6CA1\u6709\u53EF\u538B\u5236\u7684\u6D3B\u52A8\u6C61\u67D3\u6E90\u3002");
      targetId = preview.targetId;
      position = { ...preview.position };
    } else if (family === "dash") {
      if (!preview) return this.fail(this.dashCooldownMs > 0 ? "\u811A\u6B65\u5C1A\u672A\u843D\u7A33\uFF0C\u672A\u6D88\u8017\u6B21\u6570\u3002" : "\u9762\u524D\u6CA1\u6709\u8DB3\u591F\u957F\u7684\u53EF\u89C1\u901A\u8DEF\u3002");
      position = { ...preview.position };
    } else if (family === "resistance") {
      if ((this.ports.getBasePollutionResistance?.() ?? 0) >= 60) return this.fail("\u6297\u6C61\u5DF2\u7ECF\u8FBE\u5230\u4E0A\u9650\uFF0C\u672A\u6D88\u8017\u6B21\u6570\u3002");
    } else if (family === "sound_lure") {
      if (!preview) return this.fail("\u9762\u524D\u6CA1\u6709\u53EF\u89C1\u7684\u5408\u6CD5\u843D\u70B9\u3002");
      position = { ...preview.position };
    } else if (family === "tripwire") {
      if (!preview?.line) return this.fail("\u9762\u524D\u6CA1\u6709\u8DB3\u591F\u5B8C\u6574\u7684\u5730\u9762\u94FA\u7EBF\u3002");
      line = preview.line;
    } else if (family === "slow_zone") {
      if (!preview) return this.fail("\u6B64\u5904\u6CA1\u6709\u53EF\u4EE5\u627F\u91CD\u7684\u5B8C\u6574\u5730\u9762\u3002");
    } else if (family === "image_lure") {
      if (!this.ports.setVisualDecoy) return false;
    } else if (family === "survey") {
      if (!this.ports.getRevealSnapshot || !this.ports.showAbyssReveal) return false;
      snapshot = this.ports.getRevealSnapshot(ability.rangePx);
    }
    if (!commit(actionId)) return false;
    this.serial++;
    this.completedActions.push(actionId);
    const effect = {
      effectId: `ability:${this.serial}`,
      actionId,
      sourceInstanceId,
      definitionId: ability.definitionId,
      catalogVersion: ability.catalogVersion,
      resolvedParams: { ...ability },
      startTime: this.elapsedMs,
      remainingTime: ability.durationMs,
      origin,
      position,
      targetId,
      controlActive: family === "solidify",
      pulseElapsedMs: 0,
      line,
      snapshot,
      echo: null,
      affectedEnemyIds: [],
      stops: [],
      previousPositions: family === "tripwire" ? this.enemies().map((enemy) => ({ enemyId: enemy.getId(), position: { ...enemy.getPosition() } })) : []
    };
    this.effects.push(effect);
    if (family === "solidify") {
      this.ports.setEnemyControl(targetId, effect.effectId, { movementMultiplier: 0, perceptionMultiplier: 0, suppressAttack: true, breakOnDamage: true });
      const visual = this.ports.captureEnemyVisual?.(targetId);
      if (visual) this.rememberEcho(effect, captureBodyEcho(this.scene, visual, "freeze"));
    } else if (family === "suppress") {
      if (!this.ports.suppressEnvironmentHazard(targetId, effect.effectId, ability.durationMs, true)) throw new Error("Suppression target changed during atomic use");
    } else if (family === "sound_lure") this.ports.reportSoundLure(position, ability.rangePx, true);
    else if (family === "image_lure") {
      this.ports.setVisualDecoy(effect.effectId, position);
      const sprite = this.ports.getPlayerSprite?.();
      if (sprite?.texture) this.rememberEcho(effect, captureBodyEcho(this.scene, {
        textureKey: sprite.texture.key,
        frame: sprite.frame.name,
        originX: sprite.originX,
        originY: sprite.originY,
        scaleX: sprite.scaleX,
        scaleY: sprite.scaleY
      }, "mirror"));
    } else if (family === "survey") this.publishSnapshot(effect);
    else if (family === "dash") this.ports.setPlayerInput?.(false);
    this.draw(effect);
    return true;
  }
  update(deltaMs) {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) return;
    this.elapsedMs += deltaMs;
    for (const [id, remaining] of this.controlRejections) {
      if (remaining <= deltaMs) this.controlRejections.delete(id);
      else this.controlRejections.set(id, remaining - deltaMs);
    }
    this.drawControlRejections();
    this.dashCooldownMs = Math.max(0, this.dashCooldownMs - deltaMs);
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i], params = effect.resolvedParams, family = params.familyId;
      const activeDt = Math.min(effect.remainingTime, deltaMs);
      effect.remainingTime = Math.max(0, effect.remainingTime - deltaMs);
      for (let j = effect.stops.length - 1; j >= 0; j--) {
        const stop = effect.stops[j];
        stop.remainingMs -= deltaMs;
        if (stop.remainingMs <= 0) {
          this.ports.clearEnemyControl?.(stop.enemyId, effect.effectId);
          effect.stops.splice(j, 1);
        }
      }
      if (family === "solidify") {
        const enemy = this.enemies().find((row) => row.getId() === effect.targetId);
        effect.controlActive = !!enemy && (this.ports.hasEnemyControl?.(effect.targetId, effect.effectId) ?? effect.controlActive);
        if (!effect.controlActive) effect.remainingTime = 0;
        if (enemy) Object.assign(effect.position, enemy.getPosition());
      } else if (family === "dash") {
        const progress = 1 - effect.remainingTime / params.durationMs;
        const target = {
          x: effect.origin.x + (effect.position.x - effect.origin.x) * progress,
          y: effect.origin.y + (effect.position.y - effect.origin.y) * progress
        };
        if (!this.ports.advanceGroundDash?.(target, activeDt)) effect.remainingTime = 0;
        if (effect.remainingTime === 0) this.dashCooldownMs = Math.max(0, 400 - Math.max(0, deltaMs - activeDt));
      } else if (family === "sound_lure" && effect.remainingTime > 0) {
        effect.pulseElapsedMs += activeDt;
        while (effect.pulseElapsedMs >= 1e3) {
          effect.pulseElapsedMs -= 1e3;
          this.ports.reportSoundLure?.(effect.position, params.rangePx, true);
        }
      } else if (family === "tripwire" && effect.remainingTime > 0) this.updateTripwire(effect);
      else if (family === "slow_zone") this.updateSlowZone(effect);
      if (effect.remainingTime <= 0 && effect.stops.length === 0) {
        this.remove(effect);
        this.effects.splice(i, 1);
      } else this.draw(effect);
    }
  }
  exportRuntimeState() {
    const effects = this.effects.map((effect) => ({ ...effect, controlActive: effect.resolvedParams.familyId === "solidify" ? this.ports.hasEnemyControl?.(effect.targetId, effect.effectId) ?? effect.controlActive : effect.controlActive }));
    return structuredClone({
      version: 1,
      runId: this.ports.runId ?? "",
      elapsedMs: this.elapsedMs,
      serial: this.serial,
      completedActions: this.completedActions,
      dashCooldownMs: this.dashCooldownMs,
      effects,
      controlRejections: [...this.controlRejections].map(([enemyId, remainingMs]) => ({ enemyId, remainingMs }))
    });
  }
  restoreRuntimeState(value, legacyElapsedMs = 0) {
    if (value && (!validateCatalogAbilityRuntimeState(value) || value.runId !== (this.ports.runId ?? ""))) throw new Error("Invalid catalog ability continuation");
    for (const graphic2 of this.graphics.values()) graphic2.destroy();
    this.graphics.clear();
    for (const echo of this.echoes.values()) echo.destroy();
    this.echoes.clear();
    if (this.isGroundDashing() && !value?.effects.some((effect) => effect.resolvedParams.familyId === "dash")) this.ports.setPlayerInput?.(true);
    this.effects = [];
    this.completedActions = [];
    this.serial = 0;
    this.elapsedMs = 0;
    this.dashCooldownMs = 0;
    this.controlRejections.clear();
    this.rejectionGraphic?.clear();
    if (!value) {
      this.elapsedMs = legacyElapsedMs;
      return;
    }
    this.elapsedMs = value.elapsedMs;
    this.serial = value.serial;
    this.completedActions = [...value.completedActions];
    this.dashCooldownMs = value.dashCooldownMs;
    this.effects = structuredClone(value.effects);
    for (const row of value.controlRejections ?? []) this.controlRejections.set(row.enemyId, row.remainingMs);
    this.drawControlRejections();
    for (const effect of this.effects) {
      const family = effect.resolvedParams.familyId;
      if (family === "solidify" && effect.controlActive) this.ports.setEnemyControl?.(
        effect.targetId,
        effect.effectId,
        { movementMultiplier: 0, perceptionMultiplier: 0, suppressAttack: true, breakOnDamage: true }
      );
      for (const stop of effect.stops) this.ports.setEnemyControl?.(stop.enemyId, effect.effectId, { movementMultiplier: 0 });
      if (family === "slow_zone") for (const id of effect.affectedEnemyIds) this.ports.setEnemyControl?.(
        id,
        effect.effectId,
        { movementMultiplier: effect.resolvedParams.paramValue, movementGroup: "heavy-zone" }
      );
      if (family === "image_lure") this.ports.setVisualDecoy?.(effect.effectId, effect.position);
      if (family === "dash") this.ports.setPlayerInput?.(false);
      if (family === "survey") this.publishSnapshot(effect);
      const echo = restoreBodyEcho(this.scene, effect.echo);
      if (echo) this.echoes.set(effect.effectId, echo);
      this.draw(effect);
    }
  }
  destroy() {
    for (const effect of this.effects) this.remove(effect);
    this.controlRejections.clear();
    this.rejectionGraphic?.destroy();
    this.rejectionGraphic = null;
    this.effects = [];
    this.completedActions = [];
    this.serial = 0;
    this.elapsedMs = 0;
    this.dashCooldownMs = 0;
  }
  updateTripwire(effect) {
    for (const enemy of this.enemies()) {
      const id = enemy.getId(), position = enemy.getPosition();
      const previous = effect.previousPositions.find((row) => row.enemyId === id);
      if (previous && !effect.affectedEnemyIds.includes(id) && (this.ports.isTargetAlive?.(id) ?? true) && crossesToolLine(previous.position, position, effect.line)) {
        effect.affectedEnemyIds.push(id);
        if (this.ports.canApplyHardControl?.(id) ?? true) {
          this.ports.setEnemyControl?.(id, effect.effectId, { movementMultiplier: 0 });
          effect.stops.push({ enemyId: id, remainingMs: effect.resolvedParams.paramValue });
        } else this.showControlRejection(id);
      }
      if (previous) Object.assign(previous.position, position);
      else effect.previousPositions.push({ enemyId: id, position: { ...position } });
    }
  }
  updateSlowZone(effect) {
    const params = effect.resolvedParams;
    for (let i = effect.affectedEnemyIds.length - 1; i >= 0; i--) {
      const id = effect.affectedEnemyIds[i], enemy = this.enemies().find((row) => row.getId() === id);
      if (!enemy || effect.remainingTime <= 0 || !this.ports.isGroundConnected?.(effect.position, enemy.getPosition(), params.rangePx)) {
        this.ports.clearEnemyControl?.(id, effect.effectId);
        effect.affectedEnemyIds.splice(i, 1);
      }
    }
    if (effect.remainingTime <= 0) return;
    for (const enemy of this.enemies()) {
      const id = enemy.getId();
      if (!effect.affectedEnemyIds.includes(id) && (this.ports.isTargetAlive?.(id) ?? true) && this.ports.isGroundConnected?.(effect.position, enemy.getPosition(), params.rangePx)) {
        this.ports.setEnemyControl?.(id, effect.effectId, { movementMultiplier: params.paramValue, movementGroup: "heavy-zone" });
        effect.affectedEnemyIds.push(id);
      }
    }
  }
  pick(targets, range, position, alive) {
    return selectNearestVisibleTarget(this.player(), targets, {
      getPosition: position,
      isAlive: alive,
      isVisible: (target) => {
        const point = position(target), origin = this.player(), angle = this.ports.getFacingAngle?.();
        const facing = angle === void 0 || Math.abs(Math.atan2(Math.sin(Math.atan2(point.y - origin.y, point.x - origin.x) - angle), Math.cos(Math.atan2(point.y - origin.y, point.x - origin.x) - angle))) <= Math.PI / 2;
        return facing && (this.ports.isTargetVisible?.(point) ?? true);
      },
      hasLineOfSight: (from, to) => this.ports.hasTargetLineOfSight?.(from, to) ?? true,
      maxDistance: range
    });
  }
  fail(message) {
    this.failure = message;
    return false;
  }
  rememberEcho(effect, echo) {
    if (echo) {
      this.echoes.set(effect.effectId, echo);
      effect.echo = echo.exportRuntimeState();
    }
  }
  publishSnapshot(effect) {
    if (effect.snapshot) this.ports.showAbyssReveal?.(
      effect.snapshot.enemyPositions,
      effect.snapshot.nodePositions,
      effect.remainingTime,
      effect.snapshot.corePositions
    );
  }
  remove(effect) {
    const family = effect.resolvedParams.familyId;
    if (family === "solidify" && effect.targetId) this.ports.clearEnemyControl?.(effect.targetId, effect.effectId);
    if (family === "slow_zone") for (const id of effect.affectedEnemyIds) this.ports.clearEnemyControl?.(id, effect.effectId);
    for (const stop of effect.stops) this.ports.clearEnemyControl?.(stop.enemyId, effect.effectId);
    if (family === "suppress" && effect.targetId) this.ports.clearEnvironmentControl?.(effect.targetId, effect.effectId);
    if (family === "image_lure") this.ports.setVisualDecoy?.(effect.effectId, null);
    if (family === "survey") this.ports.showAbyssReveal?.([], [], 0);
    if (family === "dash") this.ports.setPlayerInput?.(true);
    this.graphics.get(effect.effectId)?.destroy();
    this.graphics.delete(effect.effectId);
    this.echoes.get(effect.effectId)?.destroy();
    this.echoes.delete(effect.effectId);
  }
  drawControlRejections() {
    this.rejectionGraphic?.clear();
    for (const [id, remaining] of this.controlRejections) {
      const enemy = this.enemies().find((row) => row.getId() === id);
      if (!enemy || !(this.ports.isTargetAlive?.(id) ?? true)) {
        this.controlRejections.delete(id);
        continue;
      }
      if (!(this.ports.isTargetVisible?.(enemy.getPosition()) ?? true)) continue;
      const g = this.rejectionGraphic ??= this.scene.add.graphics().setDepth(26);
      drawBracketMarker(g, enemy.getPosition(), GHOST_COLOR, 0.8 * remaining / 350);
    }
  }
  draw(effect) {
    const family = effect.resolvedParams.familyId;
    let g = this.graphics.get(effect.effectId);
    if (!g) {
      g = this.scene.add.graphics().setDepth(family === "solidify" ? 26 : 10);
      this.graphics.set(effect.effectId, g);
    }
    g.clear();
    const fade = Math.min(1, effect.remainingTime / 300);
    if (family === "tripwire" && effect.remainingTime > 0) {
      drawSeam(g, effect.line.pointA, effect.line.pointB, fade, effect.stops.length ? 1 : 0);
      for (const stop of effect.stops) {
        const enemy = this.enemies().find((row) => row.getId() === stop.enemyId);
        if (enemy) drawFootDrag(g, enemy.getPosition(), 1);
      }
    } else if (family === "slow_zone") drawPressure(g, effect.position, effect.resolvedParams.rangePx, fade, false);
    else if (family === "suppress") drawHostRestraint(g, effect.position, false, effect.remainingTime, this.elapsedMs);
    else if (family === "solidify") drawBracketMarker(g, effect.position, CONTAM_GLOW, fade * 0.75);
    else if (family === "sound_lure") {
      const radius = 5 + effect.pulseElapsedMs / 1e3 * 22;
      for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6;
        g.fillStyle(GHOST_COLOR, (1 - effect.pulseElapsedMs / 1e3) * fade * 0.5).fillRect(Math.round(effect.position.x + Math.cos(angle) * radius), Math.round(effect.position.y + Math.sin(angle) * radius * 0.55), 2, 1);
      }
    } else if (family === "resistance" || family === "silence") {
      const p = this.player();
      drawBracketMarker(g, { x: p.x, y: p.y + 12 }, family === "silence" ? GHOST_COLOR : CONTAM_GLOW, fade * 0.32);
    }
    if (family === "sound_lure" || family === "slow_zone") this.ports.drawCatalogToolObject?.(g, effect.definitionId, effect.position, fade);
    this.echoes.get(effect.effectId)?.update(
      effect.position,
      1 - effect.remainingTime / effect.resolvedParams.durationMs,
      this.ports.getGroundVisualDepth?.(effect.position.y) ?? 29
    );
  }
};

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/systems/enemy-control-state.ts
var EnemyControlState = class {
  sources = /* @__PURE__ */ new Map();
  movement = 1;
  perception = 1;
  blocked = false;
  interruptRevision = 0;
  protectionEnabled = false;
  protectionMs = 0;
  get controlProtectionRemainingMs() {
    return this.protectionMs;
  }
  setControlProtectionEnabled(enabled) {
    this.protectionEnabled = enabled;
    if (!enabled) this.protectionMs = 0;
  }
  canApplyHardControl() {
    return !this.protectionEnabled || this.protectionMs <= 0 && !this.hasHardControl();
  }
  tick(dtMs) {
    this.protectionMs = Math.max(0, this.protectionMs - Math.max(0, dtMs));
  }
  restoreControlProtection(remainingMs) {
    if (!Number.isFinite(remainingMs) || remainingMs < 0 || remainingMs > 2e3) throw new Error("Invalid control protection");
    this.protectionMs = remainingMs;
  }
  get movementMultiplier() {
    return this.movement;
  }
  get perceptionMultiplier() {
    return this.perception;
  }
  get attackSuppressed() {
    return this.blocked;
  }
  get attackInterruptRevision() {
    return this.interruptRevision;
  }
  /** Recovery prepares an empty projection; ToolSystem then rebuilds the owning sources. */
  beginRuntimeRestore() {
    this.sources.clear();
    this.interruptRevision = 0;
    this.protectionMs = 0;
    this.recompute();
  }
  /** Restore the historical latch after source hydration, without simulating an interruption. */
  restoreInterruptRevision(revision) {
    if (!Number.isSafeInteger(revision) || revision < 0) throw new Error("Invalid control interruption revision");
    this.interruptRevision = revision;
  }
  set(source, effect) {
    if (!source) throw new Error("Enemy control requires a source id");
    for (const value of [effect.movementMultiplier, effect.perceptionMultiplier]) {
      if (value !== void 0 && (!Number.isFinite(value) || value < 0)) {
        throw new Error("Enemy control multiplier must be finite and non-negative");
      }
    }
    if (effect.movementMultiplier === 0 && !this.sources.has(source) && !this.canApplyHardControl()) return;
    if (effect.suppressAttack && !this.sources.get(source)?.suppressAttack) this.interruptRevision++;
    this.sources.set(source, { ...effect });
    this.recompute();
  }
  has(source) {
    return this.sources.has(source);
  }
  clear(source) {
    const wasHard = this.sources.get(source)?.movementMultiplier === 0;
    if (!this.sources.delete(source)) return false;
    if (wasHard) this.finishHardControl();
    this.recompute();
    return true;
  }
  /** Call only after real positive damage, never for an attempted hit. */
  breakOnDamage() {
    let changed = false;
    let hardEnded = false;
    for (const [source, effect] of this.sources) {
      if (effect.breakOnDamage) {
        this.sources.delete(source);
        changed = true;
        hardEnded ||= effect.movementMultiplier === 0;
      }
    }
    if (hardEnded) this.finishHardControl();
    if (changed) this.recompute();
    return changed;
  }
  recompute() {
    this.movement = 1;
    this.perception = 1;
    this.blocked = false;
    let heavy = 1;
    for (const effect of this.sources.values()) {
      if (effect.movementGroup === "heavy-zone") heavy = Math.min(heavy, effect.movementMultiplier ?? 1);
      else this.movement *= effect.movementMultiplier ?? 1;
      this.perception *= effect.perceptionMultiplier ?? 1;
      this.blocked ||= effect.suppressAttack === true;
    }
    this.movement *= heavy;
  }
  hasHardControl() {
    for (const effect of this.sources.values()) if (effect.movementMultiplier === 0) return true;
    return false;
  }
  finishHardControl() {
    if (this.protectionEnabled && !this.hasHardControl()) this.protectionMs = 2e3;
  }
};

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/systems/environment-hazard-control.ts
var EnvironmentHazardControl = class _EnvironmentHazardControl {
  suppressions = /* @__PURE__ */ new Map();
  delays = /* @__PURE__ */ new Map();
  recovery = "none";
  paintInflated = false;
  protectionEnabled = false;
  protectionMs = 0;
  get protectionRemainingMs() {
    return this.protectionMs;
  }
  setControlProtectionEnabled(enabled) {
    this.protectionEnabled = enabled;
    if (!enabled) this.protectionMs = 0;
  }
  exportRuntimeState() {
    return { suppressions: [...this.suppressions], delays: [...this.delays], recovery: this.recovery, paintInflated: this.paintInflated, protectionRemainingMs: this.protectionMs };
  }
  static validateRuntimeState(value) {
    if (!runtimeRecord(value) || !["none", "wait-rest", "warning"].includes(value.recovery) || typeof value.paintInflated !== "boolean" || value.protectionRemainingMs !== void 0 && !runtimeNumber(value.protectionRemainingMs, 0, 2e3)) return false;
    return [value.suppressions, value.delays].every((rows2) => Array.isArray(rows2) && rows2.length < 1024 && rows2.every((row) => Array.isArray(row) && row.length === 2 && typeof row[0] === "string" && row[0].length > 0 && runtimeNumber(row[1], 0)) && new Set(rows2.map((row) => row[0])).size === rows2.length);
  }
  restoreRuntimeState(value) {
    if (!_EnvironmentHazardControl.validateRuntimeState(value)) throw new Error("Invalid hazard control");
    this.suppressions.clear();
    this.delays.clear();
    for (const [id, time] of value.suppressions) this.suppressions.set(id, time);
    for (const [id, time] of value.delays) this.delays.set(id, time);
    this.recovery = value.recovery;
    this.paintInflated = value.paintInflated;
    this.protectionMs = value.protectionRemainingMs ?? 0;
  }
  static valid(sourceId, durationMs) {
    return sourceId.trim().length > 0 && Number.isFinite(durationMs) && durationMs > 0;
  }
  get suppressionRemainingMs() {
    return this.maximum(this.suppressions);
  }
  get delayRemainingMs() {
    return this.maximum(this.delays);
  }
  get recoveryPending() {
    return this.recovery !== "none";
  }
  get recoveryWarning() {
    return this.recovery === "warning";
  }
  get suppressed() {
    return this.suppressions.size > 0 || this.recoveryPending;
  }
  suppress(sourceId, durationMs) {
    this.suppressions.set(sourceId, Math.max(durationMs, this.suppressions.get(sourceId) ?? 0));
    this.recovery = "none";
  }
  delay(sourceId, durationMs) {
    this.delays.set(sourceId, Math.max(durationMs, this.delays.get(sourceId) ?? 0));
  }
  /** Remove one caller's lifetime, retaining the natural recovery warning. */
  clear(sourceId) {
    const wasSuppressed = this.suppressions.delete(sourceId);
    this.delays.delete(sourceId);
    if (wasSuppressed && this.suppressions.size === 0) {
      this.recovery = "wait-rest";
      if (this.protectionEnabled) this.protectionMs = 2e3;
    }
  }
  /** Returns the fraction of this frame free to advance the natural release clock. */
  tick(dtMs) {
    this.protectionMs = Math.max(0, this.protectionMs - dtMs);
    const suppressionBefore = this.suppressionRemainingMs;
    const delayMs = this.delayRemainingMs;
    const suppressed = this.suppressions.size > 0;
    this.advance(this.delays, dtMs);
    this.advance(this.suppressions, dtMs);
    if (suppressed && this.suppressions.size === 0) {
      this.recovery = "wait-rest";
      if (this.protectionEnabled) this.protectionMs = Math.max(0, 2e3 - Math.max(0, dtMs - suppressionBefore));
    }
    return Math.max(0, dtMs - delayMs);
  }
  /** Never reactivate midway through a release; require the next natural gather warning. */
  observeVolumePhase(phase) {
    if (this.recovery === "wait-rest" && (phase === "rest" || phase === "disperse")) this.recovery = "warning";
    if (this.recovery === "warning" && phase === "gather") this.recovery = "none";
  }
  /** Continuous paint has no off phase: wait for a whole low-breath → inflation warning. */
  observePaintInflation(inflated) {
    if (this.recovery === "wait-rest" && this.paintInflated && !inflated) this.recovery = "warning";
    else if (this.recovery === "warning" && !this.paintInflated && inflated) this.recovery = "none";
    this.paintInflated = inflated;
  }
  /** Wall strikes own an explicit fresh windup, instead of a repeating volume phase. */
  observeWallWindupReset() {
    if (this.suppressions.size === 0) this.recovery = "none";
  }
  maximum(sources) {
    let maximum = 0;
    for (const remaining of sources.values()) maximum = Math.max(maximum, remaining);
    return maximum;
  }
  advance(sources, dtMs) {
    for (const [id, remaining] of sources) {
      if (remaining <= dtMs) sources.delete(id);
      else sources.set(id, remaining - dtMs);
    }
  }
};

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/systems/contaminant-drop-plan.ts
function validateContaminantDropPlan(value) {
  if (!value || typeof value !== "object") return false;
  const p = value;
  if (p.version !== 1 || p.catalogVersion !== CURRENT_CATALOG_VERSION || p.lootAlgorithmVersion !== 1 || typeof p.runId !== "string" || !p.runId || !Number.isSafeInteger(p.runSeed) || p.runSeed < 0 || p.runSeed > 4294967295 || !Array.isArray(p.entries) || p.entries.length > 4096) return false;
  if (p.tutorialNodeId !== void 0) {
    const tutorial = p.entries.find((e) => e?.nodeId === p.tutorialNodeId)?.contaminant;
    if (typeof p.tutorialNodeId !== "string" || !tutorial || tutorial.catalog?.definitionId !== "amber_beetle" || tutorial.catalog.offeringProfileId !== "resist_35" || tutorial.quality !== "ordinary") return false;
  }
  if (p.sourceRegions && (typeof p.sourceRegions !== "object" || Array.isArray(p.sourceRegions) || Object.entries(p.sourceRegions).some(([id, region]) => !id || !region || typeof region.hint !== "string" || !CATALOG_SOURCE_AFFINITIES[region.sourceTag]))) return false;
  if (p.sourceRegions && p.entries.some((entry) => p.sourceRegions[entry.nodeId]?.sourceTag !== entry.sourceTag)) return false;
  const ids = /* @__PURE__ */ new Set(), items = /* @__PURE__ */ new Set();
  return p.entries.every((e) => {
    if (!e || typeof e.nodeId !== "string" || !e.nodeId || ids.has(e.nodeId) || !CATALOG_LOOT_PROFILES[e.tier] || !CATALOG_SOURCE_AFFINITIES[e.sourceTag] || !e.contaminant || e.contaminant.type !== "catalog" || !validateCatalogContaminant(e.contaminant) || e.contaminant.catalog?.acquiredOrdinal !== 0 || e.contaminant.stage !== "defense" || e.contaminant.impactCharges !== 0 || e.contaminant.usesRemaining !== 0 || items.has(e.contaminant.id) || e.contaminant.id !== `CAT_${p.runId}_${e.nodeId}`) return false;
    ids.add(e.nodeId);
    items.add(e.contaminant.id);
    return true;
  });
}

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/generated/contaminant-economy-data.ts
var CONTAMINANT_MIGRATIONS = {
  "ruminate": {
    "target": "siphon",
    "legacyUses": 4
  },
  "resonate": {
    "target": "stitch",
    "legacyUses": 2
  },
  "overwrite": {
    "target": "mirror",
    "legacyUses": 2
  },
  "erode": {
    "target": "compress",
    "legacyUses": 2
  },
  "echo": {
    "target": "kindle",
    "legacyUses": 3
  },
  "delay": {
    "target": "delay",
    "legacyUses": 3
  },
  "siphon": {
    "target": "siphon",
    "legacyUses": 3
  },
  "stitch": {
    "target": "stitch",
    "legacyUses": 4
  },
  "compress": {
    "target": "compress",
    "legacyUses": 3
  },
  "abyss": {
    "target": "abyss",
    "legacyUses": 2
  }
};

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/generated/contaminant-quality-data.ts
var CONTAMINANT_QUALITY_DATA = {
  "ordinary": {
    "id": "ordinary",
    "name": "\u666E\u901A",
    "rank": 1,
    "standardDropWeight": 60,
    "maxUses": {
      "solidify": 5,
      "scatter": 5,
      "retrograde": 5,
      "muffle": 5,
      "expand": 3,
      "mirror": 4,
      "kindle": 5,
      "combust": 3,
      "delay": 4,
      "siphon": 5,
      "stitch": 4,
      "compress": 4,
      "abyss": 3
    }
  },
  "good": {
    "id": "good",
    "name": "\u4F18\u826F",
    "rank": 2,
    "standardDropWeight": 25,
    "maxUses": {
      "solidify": 6,
      "scatter": 6,
      "retrograde": 6,
      "muffle": 6,
      "expand": 4,
      "mirror": 5,
      "kindle": 6,
      "combust": 4,
      "delay": 5,
      "siphon": 6,
      "stitch": 5,
      "compress": 5,
      "abyss": 4
    }
  },
  "fine": {
    "id": "fine",
    "name": "\u7CBE\u826F",
    "rank": 3,
    "standardDropWeight": 12,
    "maxUses": {
      "solidify": 7,
      "scatter": 7,
      "retrograde": 7,
      "muffle": 7,
      "expand": 5,
      "mirror": 6,
      "kindle": 7,
      "combust": 5,
      "delay": 6,
      "siphon": 7,
      "stitch": 6,
      "compress": 6,
      "abyss": 5
    }
  },
  "excellent": {
    "id": "excellent",
    "name": "\u5353\u8D8A",
    "rank": 4,
    "standardDropWeight": 3,
    "maxUses": {
      "solidify": 8,
      "scatter": 8,
      "retrograde": 8,
      "muffle": 8,
      "expand": 6,
      "mirror": 7,
      "kindle": 8,
      "combust": 6,
      "delay": 7,
      "siphon": 8,
      "stitch": 7,
      "compress": 7,
      "abyss": 6
    }
  }
};

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/systems/contaminant-quality.ts
var LEGACY_QUALITY = {
  common: "ordinary",
  fine: "good",
  rare: "fine"
};
function isContaminantQuality(value) {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(CONTAMINANT_QUALITY_DATA, value);
}
function supportsContaminantQuality(type) {
  return type === "catalog" || CONTAMINANT_QUALITY_DATA.ordinary.maxUses[type] !== void 0;
}
function getContaminantQuality(item) {
  return item.quality ?? LEGACY_QUALITY[item.rarity];
}
function getContaminantMaxUses(item) {
  if (item.type === "catalog") return getCatalogMaxUses(item);
  return CONTAMINANT_QUALITY_DATA[getContaminantQuality(item)].maxUses[item.type] ?? CONTAMINANT_DATA[item.type].toolUses;
}

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/systems/contaminant-migration.ts
function migrateContaminant(item) {
  if (item.type === "catalog") return { ...item, catalog: item.catalog ? structuredClone(item.catalog) : void 0 };
  const migration = CONTAMINANT_MIGRATIONS[item.type];
  if (!migration || migration.target === item.type && item.quality !== void 0) return { ...item };
  const target = migration.target;
  const quality = getContaminantQuality(item);
  const changedFamily = target !== item.type;
  const convertQuota = !!migration && (changedFamily || item.quality === void 0);
  const migrated = {
    ...item,
    type: target,
    quality,
    rarity: changedFamily ? CONTAMINANT_DATA[target].rarity : item.rarity
  };
  if (convertQuota && item.stage === "tool" && item.usesRemaining > 0) {
    const scaled = Math.floor(item.usesRemaining * getContaminantMaxUses(migrated) / migration.legacyUses);
    migrated.usesRemaining = Math.max(1, scaled);
  }
  return migrated;
}

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/systems/equipment-lifecycle.ts
function equipmentLifecycleDefinition(item) {
  if (item.kind === "weapon") {
    const definition2 = WEAPON_DATA[item.weapon.definitionId];
    if (!definition2) throw new Error(`Unknown weapon definition: ${item.weapon.definitionId}`);
    return { offeringCharges: definition2.offeringCharges, maxUses: definition2.maxUses, chargeMultiplier: 1 };
  }
  if (item.contaminant.type === "catalog") return getContaminantLifecycleRules(item.contaminant);
  const definition = CONTAMINANT_DATA[item.contaminant.type];
  return {
    offeringCharges: GAME_CONSTANTS.TIDE.TRANSFORM_THRESHOLD,
    maxUses: getContaminantMaxUses(item.contaminant),
    chargeMultiplier: definition.defenseChargeMult
  };
}
function createWeaponInstance(definitionId, ready = false, id = `WPN_${crypto.randomUUID()}`) {
  const definition = WEAPON_DATA[definitionId];
  if (!definition) throw new Error(`Unknown weapon definition: ${definitionId}`);
  return {
    id,
    definitionId,
    stage: ready ? "tool" : "defense",
    impactCharges: ready ? definition.offeringCharges : 0,
    usesRemaining: ready ? definition.maxUses : 0
  };
}

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/types/inventory-types.ts
function getEquipmentLifecycle(item) {
  return item.kind === "weapon" ? item.weapon : item.contaminant;
}

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/systems/run-passive-receipt.ts
function createRunPassiveReceipt(contaminant, runId) {
  const binding = getBoundCatalogPassive(contaminant, runId);
  const definition = getCatalogDefinition(contaminant);
  if (!binding?.consumed || !definition) return null;
  return {
    itemId: contaminant.id,
    catalogVersion: "contaminant-v1",
    definitionId: definition.id,
    publicName: projectItemForPlayer(contaminant).name,
    familyId: binding.familyId,
    benefit: binding.benefit,
    usesConsumed: 1,
    usesRemaining: contaminant.usesRemaining
  };
}
function restoreRunPassiveReceipts(state) {
  const run = state.run;
  if (!run) return true;
  const bound = run.status === "active" ? state.items.flatMap((item) => {
    const receipt = item.kind === "contaminant" ? createRunPassiveReceipt(item.contaminant, run.id) : null;
    return receipt ? [receipt] : [];
  }) : [];
  if (run.passiveReceipts === void 0) {
    if (run.status !== "active") return true;
    run.passiveReceipts = bound;
  }
  if (!Array.isArray(run.passiveReceipts)) return false;
  const seen = /* @__PURE__ */ new Set();
  for (const receipt of run.passiveReceipts) {
    if (!receipt || typeof receipt.itemId !== "string" || !receipt.itemId || seen.has(receipt.itemId) || receipt.catalogVersion !== "contaminant-v1" || typeof receipt.definitionId !== "string" || !Object.prototype.hasOwnProperty.call(CATALOG_ITEMS, receipt.definitionId)) return false;
    const definition = CATALOG_ITEMS[receipt.definitionId];
    const maxUses = definition.baseUses + Math.max(...Object.values(CATALOG_QUALITIES).map((quality) => quality.extraUses));
    if (definition.slot !== "passive" || definition.scope !== "run" || !["sight", "capacity"].includes(receipt.familyId) || receipt.familyId !== definition.familyId || receipt.publicName !== definition.name || receipt.benefit !== definition.paramValue || receipt.usesConsumed !== 1 || !Number.isSafeInteger(receipt.usesRemaining) || receipt.usesRemaining < 0 || receipt.usesRemaining >= maxUses || !run.carriedOutIds.includes(receipt.itemId) || !state.discoveredCatalogIds?.includes(receipt.definitionId)) return false;
    const item = state.items.find((candidate) => candidate.id === receipt.itemId);
    if (item && (item.kind !== "contaminant" || item.contaminant.catalog?.definitionId !== receipt.definitionId || item.contaminant.catalog.identification !== "revealed" || item.contaminant.usesRemaining !== receipt.usesRemaining)) return false;
    if (run.status === "active") {
      const expected = bound.find((candidate) => candidate.itemId === receipt.itemId);
      if (!expected || Object.entries(expected).some(([key, value]) => receipt[key] !== value)) return false;
    } else if (!item && !run.baseSettled && run.outcome !== "death" && run.outcome !== "abandon" && !run.destroyedIds.includes(receipt.itemId)) return false;
    seen.add(receipt.itemId);
  }
  return run.status !== "active" || bound.every((receipt) => seen.has(receipt.itemId));
}

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/generated/r100-world-selection.ts
var R100_WORLD_SELECTION_POLICY = {
  "version": 1,
  "historyLimit": 8,
  "repeatWeight": 0.2,
  "neighborWeight": 0.55,
  "neighborDistance": 0.28
};

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/generation/world-study/pollution-grade.ts
var POLLUTION_GRADES = ["low", "medium", "severe"];
function isPollutionGrade(value) {
  return typeof value === "string" && POLLUTION_GRADES.some((grade) => grade === value);
}

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/types/rift-world-history.ts
function emptyRiftWorldHistory() {
  return { version: 1, visits: [] };
}
function validRiftWorldVisit(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const visit = value;
  return typeof visit.worldId === "string" && /^[a-z][a-z0-9-]{0,79}$/.test(visit.worldId) && isPollutionGrade(visit.grade);
}
function validRiftWorldHistory(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const history = value;
  return history.version === 1 && Array.isArray(history.visits) && history.visits.length <= R100_WORLD_SELECTION_POLICY.historyLimit && history.visits.every(validRiftWorldVisit);
}
function appendRiftWorldVisit(history, visit) {
  return { version: 1, visits: [...history.visits.slice(1 - R100_WORLD_SELECTION_POLICY.historyLimit), { ...visit }] };
}

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/systems/inventory-store.ts
function emptyState() {
  return { version: 4, items: [], equipment: { weaponId: null, toolIds: [], defenseIds: [] }, run: null, starterGranted: false, firstWeaponDiscovered: false, catalogTutorialRevealed: false, discoveredCatalogIds: [], offeringReceipts: {}, nextAcquiredOrdinal: 1, riftWorldHistory: emptyRiftWorldHistory() };
}
function copy(value) {
  return JSON.parse(JSON.stringify(value));
}
function fail(error) {
  return { ok: false, error };
}
function success(value) {
  return { ok: true, value };
}
function validContaminant(contaminant) {
  const c = contaminant;
  if (c?.type === "catalog") return validateCatalogContaminant(c);
  return !!c && typeof c.id === "string" && c.id.length > 0 && Object.prototype.hasOwnProperty.call(CONTAMINANT_DATA, c.type) && c.catalog === void 0 && ["common", "fine", "rare"].includes(c.rarity) && ["defense", "tool"].includes(c.stage) && Number.isFinite(c.impactCharges) && c.impactCharges >= 0 && Number.isSafeInteger(c.usesRemaining) && c.usesRemaining >= 0 && (c.quality === void 0 || isContaminantQuality(c.quality) && supportsContaminantQuality(c.type));
}
function clearReferences(state, id) {
  if (state.equipment.weaponId === id) state.equipment.weaponId = null;
  state.equipment.toolIds = state.equipment.toolIds.map((value) => value === id ? null : value);
  state.equipment.defenseIds = state.equipment.defenseIds.map((value) => value === id ? null : value);
}
var InventoryStore = class {
  state = emptyState();
  rules = { capacity: INVENTORY_RULES.carry_capacity_tenths, contaminantWeight: INVENTORY_RULES.contaminant_weight_tenths, weaponDefinition: () => void 0, isPassiveTool: () => false, toolSlotCount: () => 3, defenseSlotCount: () => 3 };
  persist = null;
  listeners = /* @__PURE__ */ new Set();
  frame = null;
  configure(rules) {
    this.rules = { ...this.rules, ...rules };
  }
  setPersistence(persist) {
    this.persist = persist;
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  getState() {
    return copy(this.state);
  }
  getItems() {
    return this.state.items;
  }
  getOfferingItems() {
    return Array.from({ length: this.rules.defenseSlotCount() }, (_, slot) => {
      const id = this.state.equipment.defenseIds[slot];
      return id ? this.getItem(id) ?? null : null;
    });
  }
  getItem(id) {
    return this.state.items.find((item) => item.id === id);
  }
  getEquipment() {
    return this.state.equipment;
  }
  getRun() {
    return this.state.run;
  }
  getRiftWorldHistory() {
    return copy(this.state.riftWorldHistory);
  }
  isCatalogTutorialEligible() {
    return !this.state.catalogTutorialRevealed;
  }
  getDiscoveredCatalogIds() {
    return this.state.discoveredCatalogIds ?? [];
  }
  getCapacity() {
    return this.capacity(this.state);
  }
  capacity(state) {
    const item = state.items.find((item2) => item2.kind === "contaminant" && state.equipment.toolIds.includes(item2.id) && getCatalogRuntimeAbility(item2.contaminant)?.familyId === "capacity");
    if (item?.kind !== "contaminant") return this.rules.capacity;
    const c = item.contaminant, ability = getCatalogRuntimeAbility(c);
    if (state.run?.status === "active") return this.rules.capacity + (c.catalog?.runBinding?.runId === state.run.id ? c.catalog.runBinding.benefit * 10 : 0);
    return this.rules.capacity + (c.usesRemaining > 0 ? ability.paramValue * 10 : 0);
  }
  getWeight(itemOrId) {
    const item = typeof itemOrId === "string" ? this.getItem(itemOrId) : itemOrId;
    if (!item) return Infinity;
    const weight = item.kind === "contaminant" ? item.contaminant.type === "catalog" ? getCatalogItemWeight(item.contaminant) : this.rules.contaminantWeight : this.rules.weaponDefinition(item.weapon.definitionId)?.weight;
    return weight !== void 0 && Number.isSafeInteger(weight) && weight > 0 ? weight : Infinity;
  }
  getCarryWeight() {
    return this.weight(this.state);
  }
  isEquipped(id) {
    return this.state.equipment.weaponId === id || this.state.equipment.toolIds.includes(id);
  }
  /** Legacy lifecycle facade only: payload identity must remain stable for ToolSystem. */
  getContaminants() {
    return this.state.items.flatMap((item) => item.kind === "contaminant" ? [item.contaminant] : []);
  }
  /** These arrays are owned here; legacy lifecycle transforms mutate them at base only. */
  getLegacySlots() {
    return { defenseSlots: this.state.equipment.defenseIds, sortieLoadout: this.state.equipment.toolIds };
  }
  weight(state) {
    return state.items.reduce((sum, item) => sum + (item.location.kind === "carried" ? this.getWeight(item) : 0), 0);
  }
  notify() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        console.error("Inventory subscriber failed after commit", error);
      }
    }
  }
  publish(next, notify = true) {
    for (const item of next.items) {
      const previous = this.getItem(item.id);
      if (item.kind === "contaminant" && previous?.kind === "contaminant") {
        if (item.contaminant.quality === void 0) delete previous.contaminant.quality;
        Object.assign(previous.contaminant, item.contaminant);
        item.contaminant = previous.contaminant;
      }
    }
    const remainingIds = new Set(next.items.map((item) => item.id));
    for (const previous of this.state.items) {
      if (previous.kind === "contaminant" && !remainingIds.has(previous.id)) {
        previous.contaminant.usesRemaining = 0;
        previous.contaminant.stage = "broken";
      }
    }
    this.state = next;
    if (notify) this.notify();
  }
  transaction(mutate) {
    if (this.frame?.locked) return fail("storage-failed");
    const draft = copy(this.state);
    const result2 = mutate(draft);
    if (!result2.ok) return result2;
    if (this.frame) {
      this.frame.changed = true;
      this.publish(draft, false);
      return result2;
    }
    try {
      this.persist?.(copy(draft));
    } catch {
      return fail("storage-failed");
    }
    this.publish(draft);
    return result2;
  }
  /** Explicit opt-in for a scene that saves inventory and its resulting world
   * together. The ordinary inventory transaction path is unchanged. */
  beginFrameTransaction() {
    if (this.frame) throw new Error("Inventory frame is already open");
    this.frame = { before: this.getState(), changed: false, locked: false };
  }
  hasFrameTransaction() {
    return this.frame !== null;
  }
  hasFrameChanges() {
    return this.frame?.changed ?? false;
  }
  /** The caller captures an immutable whole-world candidate before calling
   * this, and retries those exact bytes on failure. Never re-run gameplay. */
  commitFrameTransaction(persistCompleteFrame) {
    const frame = this.frame;
    if (!frame) throw new Error("No inventory frame to commit");
    frame.locked = true;
    try {
      persistCompleteFrame(this.getState());
    } catch {
      return false;
    }
    this.frame = null;
    if (frame.changed) this.notify();
    return true;
  }
  /** Teardown only: the coordinator must also discard the matching uncommitted
   * world. This does not offer a user-selectable historical checkpoint. */
  cancelFrameTransaction() {
    const frame = this.frame;
    if (!frame) return;
    this.frame = null;
    this.publish(frame.before);
  }
  loadState(state) {
    if (!state || ![1, 2, 3, 4].includes(state.version) || !Array.isArray(state.items) || !state.equipment || !Array.isArray(state.equipment.toolIds) || !Array.isArray(state.equipment.defenseIds)) return false;
    state = copy(state);
    if (state.version < 4 && state.riftWorldHistory === void 0) state.riftWorldHistory = emptyRiftWorldHistory();
    if (!validRiftWorldHistory(state.riftWorldHistory)) return false;
    if (state.version === 1) {
      for (const item of state.items) if (item?.kind === "weapon" && item.weapon && item.weapon.stage === void 0) {
        try {
          item.weapon = createWeaponInstance(item.weapon.definitionId, true, item.id);
        } catch {
          return false;
        }
      }
    }
    const legacySchema = state.version < 3;
    state.version = 4;
    state.catalogTutorialRevealed ??= legacySchema;
    if (typeof state.catalogTutorialRevealed !== "boolean") return false;
    state.discoveredCatalogIds ??= [];
    state.offeringReceipts ??= {};
    state.nextAcquiredOrdinal ??= 1;
    if (!Array.isArray(state.discoveredCatalogIds) || new Set(state.discoveredCatalogIds).size !== state.discoveredCatalogIds.length || state.discoveredCatalogIds.some((id) => !CATALOG_ITEMS[id]) || !Number.isSafeInteger(state.nextAcquiredOrdinal) || state.nextAcquiredOrdinal < 1 || !state.offeringReceipts || typeof state.offeringReceipts !== "object" || Array.isArray(state.offeringReceipts)) return false;
    const ids = /* @__PURE__ */ new Set();
    for (const item of state.items) {
      if (!item || typeof item.id !== "string" || !item.id || ids.has(item.id) || !item.location || !["stash", "carried", "ground", "defense"].includes(item.location.kind)) return false;
      if (item.kind === "weapon") {
        if (item.weapon?.id !== item.id || typeof item.weapon.definitionId !== "string") return false;
        const w = item.weapon;
        if (!["defense", "tool"].includes(w.stage) || !Number.isFinite(w.impactCharges) || w.impactCharges < 0 || !Number.isSafeInteger(w.usesRemaining) || w.usesRemaining < 0 || w.stage === "tool" && w.usesRemaining === 0) return false;
        try {
          equipmentLifecycleDefinition(item);
        } catch {
          return false;
        }
      } else if (item.kind === "contaminant") {
        const c = item.contaminant;
        if (!validContaminant(c) || c.id !== item.id) return false;
        item.contaminant = migrateContaminant(c);
      } else return false;
      if (item.location.kind === "ground" && (!item.location.position || !Number.isFinite(item.location.position.x) || !Number.isFinite(item.location.position.y) || item.location.runId !== state.run?.id)) return false;
      if (item.location.kind === "defense" && (!Number.isInteger(item.location.slot) || item.location.slot < 0)) return false;
      ids.add(item.id);
    }
    const equipped = /* @__PURE__ */ new Set();
    const refs = [state.equipment.weaponId, ...state.equipment.toolIds, ...state.equipment.defenseIds];
    for (const id of refs) {
      if (id === null) continue;
      if (typeof id !== "string" || !ids.has(id) || equipped.has(id)) return false;
      equipped.add(id);
    }
    if (state.equipment.weaponId) {
      const weapon = state.items.find((item) => item.id === state.equipment.weaponId);
      if (weapon?.kind !== "weapon" || weapon.weapon.stage !== "tool" || weapon.weapon.usesRemaining <= 0 || weapon.location.kind !== "carried") return false;
    }
    for (const id of state.equipment.toolIds) {
      if (!id) continue;
      const item = state.items.find((value) => value.id === id);
      if (item?.kind !== "contaminant" || item.contaminant.stage !== "tool" || item.location.kind !== "carried") return false;
    }
    for (let slot = 0; slot < state.equipment.defenseIds.length; slot++) {
      const id = state.equipment.defenseIds[slot];
      if (!id) continue;
      const item = state.items.find((value) => value.id === id);
      if (!item || getEquipmentLifecycle(item).stage !== "defense" || item.location.kind !== "defense" || item.location.slot !== slot) return false;
    }
    if (state.run && (typeof state.run.id !== "string" || !["active", "settled"].includes(state.run.status) || !Array.isArray(state.run.carriedOutIds) || !Array.isArray(state.run.destroyedIds) || !state.run.revealedNodes || typeof state.run.revealedNodes !== "object")) return false;
    if (state.run) {
      const run = state.run;
      if (run.catalogVersion !== void 0 && !["legacy-v1", "contaminant-v1"].includes(run.catalogVersion)) return false;
      if (run.lootAlgorithmVersion !== void 0 && run.lootAlgorithmVersion !== 1) return false;
      if (run.combatRulesVersion !== void 0 && ![1, 2].includes(run.combatRulesVersion)) return false;
      if (run.dropPlan && (!validateContaminantDropPlan(run.dropPlan) || run.dropPlan.runId !== run.id || run.dropPlan.catalogVersion !== run.catalogVersion)) return false;
      if (run.actionReceipts && (typeof run.actionReceipts !== "object" || Array.isArray(run.actionReceipts) || Object.entries(run.actionReceipts).some(([id, r]) => !id || !r || typeof r.itemId !== "string" || typeof r.broken !== "boolean" || !Number.isSafeInteger(r.usesLeft) || r.usesLeft < 0 || r.broken !== (r.usesLeft === 0) || r.definitionId !== void 0 && (!Object.prototype.hasOwnProperty.call(CATALOG_ITEMS, r.definitionId) || r.catalogVersion !== "contaminant-v1") || r.catalogVersion !== void 0 && r.definitionId === void 0))) return false;
    }
    const catalogOrdinals = /* @__PURE__ */ new Set();
    for (const item of state.items) if (item.kind === "contaminant" && item.contaminant.catalog) {
      const c = item.contaminant, meta = c.catalog;
      if (meta.acquiredOrdinal < 1 || meta.acquiredOrdinal >= state.nextAcquiredOrdinal || catalogOrdinals.has(meta.acquiredOrdinal)) return false;
      catalogOrdinals.add(meta.acquiredOrdinal);
      if (meta.identification === "revealed" && !state.discoveredCatalogIds.includes(meta.definitionId)) return false;
      if (meta.runBinding && (state.run?.status !== "active" || meta.runBinding.runId !== state.run.id || item.location.kind !== "carried" || !state.equipment.toolIds.includes(item.id))) return false;
    }
    for (const [key, receipts] of Object.entries(state.offeringReceipts)) if (!key || !Array.isArray(receipts) || receipts.some((r) => !r || typeof r.itemId !== "string" || !["weapon", "contaminant"].includes(r.kind) || typeof r.definitionId !== "string" || !Number.isInteger(r.slotIndex) || r.slotIndex < 0)) return false;
    if (!restoreRunPassiveReceipts(state)) return false;
    this.publish(copy(state));
    return true;
  }
  reset() {
    this.publish(emptyState());
  }
  /** Explicit V1/dev import; supplies the sole canonical contaminant payloads. */
  importLegacy(contaminants, defenseIds, toolIds) {
    const state = emptyState();
    state.catalogTutorialRevealed = true;
    state.items = contaminants.map((contaminant) => {
      const defense = defenseIds.indexOf(contaminant.id);
      return { kind: "contaminant", id: contaminant.id, contaminant: { ...contaminant }, location: defense >= 0 ? { kind: "defense", slot: defense } : toolIds.includes(contaminant.id) ? { kind: "carried" } : { kind: "stash" } };
    });
    const valid = new Set(contaminants.map((c) => c.id));
    state.equipment.defenseIds = defenseIds.map((id) => id && valid.has(id) ? id : null);
    state.equipment.toolIds = toolIds.map((id) => id && valid.has(id) ? id : null);
    if (!this.loadState(state)) throw new Error("Invalid legacy inventory");
  }
  ensureStarter(replacementId) {
    if (this.state.run?.status === "active") return fail("run-active");
    const owned = this.state.items.find((item) => item.kind === "weapon" && item.weapon.stage === "tool" && item.weapon.usesRemaining > 0);
    if (owned) return success(owned.id);
    const definitionId = this.rules.starterDefinitionId;
    if (!definitionId || !this.rules.weaponDefinition(definitionId)) return fail("missing-weapon");
    return this.transaction((state) => {
      const id = replacementId ?? `WPN_${crypto.randomUUID()}`;
      if (state.items.some((item) => item.id === id)) return fail("duplicate-id");
      state.items.push({ kind: "weapon", id, weapon: createWeaponInstance(definitionId, true, id), location: { kind: "carried" } });
      state.equipment.weaponId = id;
      state.starterGranted = true;
      return success(id);
    });
  }
  addContaminant(contaminant) {
    if (!validContaminant(contaminant)) return fail("invalid-item");
    contaminant = migrateContaminant(contaminant);
    return this.transaction((state) => {
      if (state.items.some((item) => item.id === contaminant.id)) return fail("duplicate-id");
      const payload = copy(contaminant);
      if (payload.catalog) payload.catalog.acquiredOrdinal = state.nextAcquiredOrdinal++;
      state.items.push({ kind: "contaminant", id: contaminant.id, contaminant: payload, location: { kind: state.run?.status === "active" ? "carried" : "stash" } });
      return state.run?.status === "active" && this.weight(state) > this.capacity(state) ? fail("overweight") : success(contaminant.id);
    });
  }
  prepareWeapon(id) {
    return this.transaction((state) => {
      if (state.run?.status === "active") return fail("run-active");
      const item = state.items.find((value) => value.id === id);
      if (item?.kind !== "weapon" || !["stash", "carried"].includes(item.location.kind)) return fail("invalid-item");
      if (item.weapon.stage !== "tool" || item.weapon.usesRemaining <= 0) return fail("not-ready");
      const old = state.items.find((value) => value.id === state.equipment.weaponId);
      if (old) old.location = { kind: "stash" };
      item.location = { kind: "carried" };
      state.equipment.weaponId = id;
      return success(void 0);
    });
  }
  prepareTool(id, slot) {
    return this.transaction((state) => {
      if (state.run?.status === "active") return fail("run-active");
      const count = this.rules.toolSlotCount();
      if (slot < 0 || slot >= count) return fail("incompatible");
      const item = id ? state.items.find((value) => value.id === id) : void 0;
      if (id && (item?.kind !== "contaminant" || item.contaminant.stage !== "tool" || item.contaminant.usesRemaining <= 0 || !getContaminantSlot(item.contaminant) || !["stash", "carried"].includes(item.location.kind))) return fail("incompatible");
      if (item?.kind === "contaminant" && getContaminantSlot(item.contaminant) === "passive" !== (slot === count - 1)) return fail("incompatible");
      const old = state.items.find((value) => value.id === state.equipment.toolIds[slot]);
      if (old) old.location = { kind: "stash" };
      if (id) state.equipment.toolIds = state.equipment.toolIds.map((value) => value === id ? null : value);
      state.equipment.toolIds[slot] = id;
      if (item) item.location = { kind: "carried" };
      return success(void 0);
    });
  }
  /** Preserve an equipped passive when a base upgrade moves the final slot.
   * Only the old passive position may move; never displace another item. */
  reconcileExpandedToolSlots(previousSlotCount) {
    if (this.state.run?.status === "active") return fail("run-active");
    const count = this.rules.toolSlotCount();
    if (!Number.isSafeInteger(previousSlotCount) || previousSlotCount < 1 || count <= previousSlotCount) return success(false);
    const previousSlot = previousSlotCount - 1;
    const id = this.state.equipment.toolIds[previousSlot];
    const item = id ? this.getItem(id) : void 0;
    const movesPassive = item?.kind === "contaminant" && getContaminantSlot(item.contaminant) === "passive";
    if (movesPassive && this.state.equipment.toolIds[count - 1]) return fail("incompatible");
    if (!movesPassive && this.state.equipment.toolIds.length >= count) return success(false);
    return this.transaction((state) => {
      while (state.equipment.toolIds.length < count) state.equipment.toolIds.push(null);
      if (movesPassive && item) {
        state.equipment.toolIds[previousSlot] = null;
        state.equipment.toolIds[count - 1] = item.id;
      }
      return success(true);
    });
  }
  slotDefense(id, slot) {
    return this.slotOffering(id, slot);
  }
  slotOffering(id, slot) {
    return this.transaction((state) => {
      if (state.run?.status === "active") return fail("run-active");
      if (slot < 0 || slot >= this.rules.defenseSlotCount()) return fail("incompatible");
      const item = id ? state.items.find((value) => value.id === id) : void 0;
      if (id && (!item || getEquipmentLifecycle(item).stage !== "defense" || item.location.kind !== "stash")) return fail("incompatible");
      const old = state.items.find((value) => value.id === state.equipment.defenseIds[slot]);
      if (id && old && old.id !== id) return fail("incompatible");
      if (old) old.location = { kind: "stash" };
      state.equipment.defenseIds[slot] = id;
      if (item) item.location = { kind: "defense", slot };
      return success(void 0);
    });
  }
  beginRun(runId, versions2, worldVisit) {
    return this.transaction((state) => {
      if (worldVisit !== void 0 && !validRiftWorldVisit(worldVisit)) return fail("invalid-item");
      if (state.run?.id === runId) return fail("run-active");
      if (state.run?.status === "active") return fail("run-active");
      if (!state.equipment.weaponId || !state.items.some((item) => item.id === state.equipment.weaponId && item.kind === "weapon" && item.weapon.stage === "tool" && item.weapon.usesRemaining > 0)) return fail("missing-weapon");
      if (this.weight(state) > this.capacity(state)) return fail("overweight");
      const toolSlotCount = this.rules.toolSlotCount();
      for (let slot = 0; slot < state.equipment.toolIds.length; slot++) {
        const id = state.equipment.toolIds[slot];
        if (!id) continue;
        const item = state.items.find((value) => value.id === id);
        if (slot >= toolSlotCount || item?.kind !== "contaminant" || item.contaminant.stage !== "tool" || item.contaminant.usesRemaining <= 0 || getContaminantSlot(item.contaminant) === "passive" !== (slot === toolSlotCount - 1)) return fail("incompatible");
      }
      const equipped = /* @__PURE__ */ new Set([state.equipment.weaponId, ...state.equipment.toolIds]);
      if (state.items.some((item) => item.location.kind === "carried" && !equipped.has(item.id))) return fail("wrong-location");
      for (const id of state.equipment.toolIds) {
        const item = state.items.find((item2) => item2.id === id);
        if (item?.kind !== "contaminant" || item.contaminant.type !== "catalog") continue;
        const c = item.contaminant, ability = getCatalogRuntimeAbility(c);
        if (ability?.slot === "passive" && (ability.familyId === "sight" || ability.familyId === "capacity")) {
          if (!c.catalog || c.catalog.runBinding || c.usesRemaining <= 0) return fail("incompatible");
          c.usesRemaining--;
          c.catalog.runBinding = { runId, consumed: true, familyId: ability.familyId, benefit: ability.paramValue };
        }
      }
      const passiveReceipts = state.items.flatMap((item) => {
        const receipt = item.kind === "contaminant" ? createRunPassiveReceipt(item.contaminant, runId) : null;
        return receipt ? [receipt] : [];
      });
      state.run = { id: runId, status: "active", carriedOutIds: state.items.filter((item) => item.location.kind === "carried").map((item) => item.id), revealedNodes: {}, destroyedIds: [], ...versions2, actionReceipts: {}, passiveReceipts };
      if (worldVisit) state.riftWorldHistory = appendRiftWorldVisit(state.riftWorldHistory, worldVisit);
      return success(void 0);
    });
  }
  installDropPlan(plan2) {
    return this.transaction((state) => {
      const run = state.run;
      if (!run || run.status !== "active") return fail("no-active-run");
      if (!validateContaminantDropPlan(plan2) || plan2.runId !== run.id || run.catalogVersion !== plan2.catalogVersion || run.lootAlgorithmVersion !== plan2.lootAlgorithmVersion) return fail("invalid-item");
      if (run.dropPlan) return JSON.stringify(run.dropPlan) === JSON.stringify(plan2) ? success(void 0) : fail("invalid-item");
      if (Object.keys(run.revealedNodes).length) return fail("invalid-item");
      run.dropPlan = copy(plan2);
      return success(void 0);
    });
  }
  revealBatch(nodeId, items, position) {
    return this.transaction((state) => {
      const run = state.run;
      if (!run || run.status !== "active") return fail("no-active-run");
      const existing = run.revealedNodes[nodeId];
      if (existing) return success({ ids: [...existing], taken: existing.every((id) => state.items.find((item) => item.id === id)?.location.kind === "carried") });
      if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return fail("invalid-ground");
      const expectedCatalog = run.dropPlan?.entries.find((entry) => entry.nodeId === nodeId)?.contaminant;
      if (expectedCatalog && (items.length !== 1 || items[0]?.kind !== "contaminant" || JSON.stringify(items[0].contaminant) !== JSON.stringify(expectedCatalog))) return fail("invalid-item");
      const ids = new Set(state.items.map((item) => item.id));
      for (const item of items) {
        if (ids.has(item.id)) return fail("duplicate-id");
        if (item.id !== (item.kind === "weapon" ? item.weapon.id : item.contaminant.id) || !Number.isFinite(this.getWeight({ ...item, location: { kind: "stash" } }))) return fail("invalid-item");
        if (item.kind === "weapon" && (!["defense", "tool"].includes(item.weapon.stage) || !Number.isSafeInteger(item.weapon.usesRemaining) || item.weapon.usesRemaining < 0)) return fail("invalid-item");
        if (item.kind === "contaminant" && !validContaminant(item.contaminant)) return fail("invalid-item");
        if (item.kind === "contaminant" && item.contaminant.type === "catalog") {
          const planned = run.dropPlan?.entries.find((entry) => entry.nodeId === nodeId)?.contaminant;
          if (!planned || JSON.stringify(planned) !== JSON.stringify(item.contaminant)) return fail("invalid-item");
        }
        ids.add(item.id);
      }
      const revealed = items.map((item) => ({ ...copy(item), location: { kind: "ground", runId: run.id, position: { ...position } }, source: { ...item.source, nodeId, runId: run.id } }));
      for (const item of revealed) if (item.kind === "contaminant") {
        item.contaminant = migrateContaminant(item.contaminant);
        if (item.contaminant.catalog) item.contaminant.catalog.acquiredOrdinal = state.nextAcquiredOrdinal++;
      }
      const taken = this.weight(state) + revealed.reduce((sum, item) => sum + this.getWeight(item), 0) <= this.capacity(state);
      if (taken) for (const item of revealed) item.location = { kind: "carried" };
      state.items.push(...revealed);
      run.revealedNodes[nodeId] = revealed.map((item) => item.id);
      if (revealed.some((item) => item.kind === "weapon")) state.firstWeaponDiscovered = true;
      if (run.dropPlan?.tutorialNodeId === nodeId) state.catalogTutorialRevealed = true;
      return success({ ids: [...run.revealedNodes[nodeId]], taken });
    });
  }
  take(ids, canTake) {
    return this.exchange(ids, [], { x: 0, y: 0 }, { canTake, canDrop: () => true });
  }
  drop(ids, position, canDrop) {
    return this.exchange([], ids, position, { canTake: () => false, canDrop });
  }
  exchange(takeIds, dropIds, position, validation) {
    return this.transaction((state) => {
      const run = state.run;
      if (!run || run.status !== "active") return fail("no-active-run");
      if ((/* @__PURE__ */ new Set([...takeIds, ...dropIds])).size !== takeIds.length + dropIds.length) return fail("duplicate-id");
      if (dropIds.length && (!Number.isFinite(position.x) || !Number.isFinite(position.y) || !validation.canDrop(position))) return fail("invalid-ground");
      for (const id of takeIds) {
        const item = state.items.find((value) => value.id === id);
        if (!item || item.location.kind !== "ground" || item.location.runId !== run.id) return fail("wrong-location");
        if (!validation.canTake(item)) return fail("invalid-ground");
        item.location = { kind: "carried" };
      }
      for (const id of dropIds) {
        const item = state.items.find((value) => value.id === id);
        if (!item || item.location.kind !== "carried") return fail("wrong-location");
        if (this.isEquipped(id)) return fail("equipped");
        item.location = { kind: "ground", runId: run.id, position: { ...position } };
      }
      return this.weight(state) > this.capacity(state) ? fail("overweight") : success(void 0);
    });
  }
  consumeTool(id, actionId) {
    if (actionId && this.state.run?.actionReceipts?.[actionId]) return fail("duplicate-action");
    if (this.getItem(id)?.kind !== "contaminant") return fail("invalid-item");
    return this.consumeEquipmentUse(id, actionId);
  }
  consumeEquipmentUse(id, actionId) {
    return this.transaction((state) => {
      if (actionId !== void 0 && (!actionId || !state.run || state.run.status !== "active")) return fail("invalid-item");
      if (actionId && state.run?.actionReceipts?.[actionId]) return fail("duplicate-action");
      const item = state.items.find((value) => value.id === id);
      if (!item) return fail("invalid-item");
      if (item.kind === "contaminant" && getCatalogRuntimeAbility(item.contaminant)?.slot === "passive") return fail("incompatible");
      const lifecycle = getEquipmentLifecycle(item);
      if (lifecycle.stage !== "tool" || lifecycle.usesRemaining <= 0) return fail("invalid-item");
      if (item.location.kind !== "carried") return fail("wrong-location");
      const equipped = item.kind === "weapon" ? state.equipment.weaponId === id : state.equipment.toolIds.includes(id);
      if (!equipped) return fail("equipped");
      lifecycle.usesRemaining--;
      const broken = lifecycle.usesRemaining === 0;
      if (broken) {
        clearReferences(state, id);
        state.items = state.items.filter((value) => value.id !== id);
        state.run?.destroyedIds.push(id);
      }
      if (actionId && state.run) {
        state.run.actionReceipts ??= {};
        Object.defineProperty(state.run.actionReceipts, actionId, { value: { itemId: id, broken, usesLeft: lifecycle.usesRemaining, ...item.kind === "contaminant" && item.contaminant.catalog ? { definitionId: item.contaminant.catalog.definitionId, catalogVersion: item.contaminant.catalog.catalogVersion } : {} }, enumerable: true, writable: true, configurable: true });
      }
      return success({ broken, usesLeft: lifecycle.usesRemaining });
    });
  }
  finishOfferingImpact(snapshotIds, normalCharges, bonusCharges = {}, impactId) {
    return this.transaction((state) => {
      if (state.run?.status === "active") return fail("run-active");
      if (!Number.isFinite(normalCharges) || normalCharges < 0 || impactId !== void 0 && !impactId) return fail("invalid-item");
      if (!impactId && snapshotIds.some((id) => state.items.some((item) => item.id === id && item.kind === "contaminant" && item.contaminant.type === "catalog"))) return fail("invalid-item");
      if (impactId && Object.prototype.hasOwnProperty.call(state.offeringReceipts, impactId)) return success([]);
      const results = [];
      const visited = /* @__PURE__ */ new Set();
      for (let slot = 0; slot < snapshotIds.length; slot++) {
        const id = snapshotIds[slot];
        if (!id || visited.has(id)) continue;
        visited.add(id);
        const item = state.items.find((value) => value.id === id);
        if (!item || item.location.kind !== "defense" || state.equipment.defenseIds[slot] !== id) continue;
        const lifecycle = getEquipmentLifecycle(item);
        if (lifecycle.stage !== "defense") continue;
        const rule = equipmentLifecycleDefinition(item);
        const bonus = bonusCharges[id] ?? 0;
        if (!Number.isFinite(bonus) || bonus < 0) return fail("invalid-item");
        lifecycle.impactCharges += normalCharges * rule.chargeMultiplier + bonus;
        if (lifecycle.impactCharges < rule.offeringCharges) continue;
        lifecycle.stage = "tool";
        lifecycle.usesRemaining = rule.maxUses;
        if (item.kind === "contaminant" && item.contaminant.type === "catalog") {
          const c = item.contaminant, identity = c.catalog;
          identity.identification = "revealed";
          identity.revealedAt = Date.now();
          identity.revealReceiptId = `${impactId ?? "impact"}:${item.id}`;
          if (getCatalogDefinition(c)?.class === "inert") lifecycle.stage = "inert";
          if (!state.discoveredCatalogIds.includes(identity.definitionId)) state.discoveredCatalogIds.push(identity.definitionId);
        }
        item.location = { kind: "stash" };
        state.equipment.defenseIds[slot] = null;
        results.push({
          itemId: id,
          kind: item.kind,
          definitionId: item.kind === "weapon" ? item.weapon.definitionId : item.contaminant.catalog?.definitionId ?? item.contaminant.type,
          slotIndex: slot
        });
      }
      if (impactId) Object.defineProperty(state.offeringReceipts, impactId, { value: copy(results), enumerable: true, writable: true, configurable: true });
      return success(results);
    });
  }
  discardAtBase(id) {
    return this.transaction((state) => {
      if (state.run?.status === "active") return fail("run-active");
      const item = state.items.find((value) => value.id === id);
      if (!item || item.location.kind !== "stash") return fail("wrong-location");
      clearReferences(state, id);
      state.items = state.items.filter((value) => value.id !== id);
      return success(void 0);
    });
  }
  settleRun(runId, outcome, kindlingGained = 0) {
    return this.transaction((state) => {
      const run = state.run;
      if (!run || run.id !== runId) return fail("no-active-run");
      if (run.status === "settled") return success({ returnedIds: [...run.returnedIds ?? []] });
      const returnedIds = [];
      state.items = state.items.filter((item) => {
        if (item.location.kind === "ground") return false;
        if (item.location.kind !== "carried") return true;
        if (outcome === "death" || outcome === "abandon" || outcome === "abandon-keep" && !run.carriedOutIds.includes(item.id)) {
          clearReferences(state, item.id);
          return false;
        }
        if (!run.carriedOutIds.includes(item.id)) returnedIds.push(item.id);
        if (state.equipment.weaponId !== item.id && !state.equipment.toolIds.includes(item.id)) item.location = { kind: "stash" };
        return true;
      });
      const expired = [];
      for (const item of state.items) {
        if (item.kind !== "contaminant" || item.contaminant.catalog?.runBinding?.runId !== run.id) continue;
        delete item.contaminant.catalog.runBinding;
        if (item.contaminant.usesRemaining === 0) expired.push(item.id);
      }
      for (const id of expired) {
        clearReferences(state, id);
        state.items = state.items.filter((item) => item.id !== id);
        if (!run.destroyedIds.includes(id)) run.destroyedIds.push(id);
      }
      run.status = "settled";
      run.outcome = outcome;
      run.returnedIds = returnedIds;
      run.kindlingGained = outcome === "extract" ? kindlingGained : 0;
      return success({ returnedIds });
    });
  }
  markBaseSettled() {
    return this.transaction((state) => {
      if (!state.run || state.run.status !== "settled") return fail("no-active-run");
      state.run.baseSettled = true;
      return success(void 0);
    });
  }
  /** Caller must obtain an explicit interrupted-run policy; no implicit death. */
  recoverInterruptedRun(policy) {
    const run = this.state.run;
    if (!run) return fail("no-active-run");
    return this.settleRun(run.id, policy === "lose-carried" ? "death" : "abandon-keep");
  }
};
var inventoryStore = new InventoryStore();

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/generation/world-study/native-body-collision.ts
var EPSILON = 1e-7;
var SEPARATION = 1e-4;
function polygon(points2) {
  if (points2.length < 3) return null;
  let area = 0;
  for (let i = 0; i < points2.length; i++) {
    const a = points2[i], b = points2[(i + 1) % points2.length];
    area += a.x * b.y - b.x * a.y;
  }
  if (Math.abs(area) < EPSILON) return null;
  const normals = [{ x: 1, y: 0 }, { x: 0, y: 1 }];
  for (let i = 0; i < points2.length; i++) {
    const a = points2[i], b = points2[(i + 1) % points2.length], x = b.y - a.y, y = a.x - b.x, length = Math.hypot(x, y);
    if (length > EPSILON) normals.push({ x: x / length, y: y / length });
  }
  const axes = normals.map(({ x, y }) => {
    let min = Infinity, max = -Infinity;
    for (const point of points2) {
      const value = point.x * x + point.y * y;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    return { x, y, min, max };
  });
  return { points: points2, axes, minX: axes[0].min, maxX: axes[0].max, minY: axes[1].min, maxY: axes[1].max };
}
function clip(points2, axis, limit, greater) {
  const result2 = [];
  for (let i = 0; i < points2.length; i++) {
    const a = points2[i], b = points2[(i + 1) % points2.length];
    const insideA = greater ? a[axis] >= limit : a[axis] <= limit;
    const insideB = greater ? b[axis] >= limit : b[axis] <= limit;
    if (insideA) result2.push(a);
    if (insideA !== insideB) {
      const t = (limit - a[axis]) / (b[axis] - a[axis]);
      result2.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return result2;
}
function outsideExemption(p, box2) {
  if (p.maxX <= box2.left || p.minX >= box2.right || p.maxY <= box2.top || p.minY >= box2.bottom) return [p];
  const horizontal = clip(clip(p.points, "x", box2.left, true), "x", box2.right, false);
  return [
    clip(p.points, "x", box2.left, false),
    clip(p.points, "x", box2.right, true),
    clip(horizontal, "y", box2.top, false),
    clip(horizontal, "y", box2.bottom, true)
  ].map(polygon).filter((value) => value !== null);
}
function overlap(p, center, halfW, halfH) {
  if (center.x + halfW <= p.minX + EPSILON || center.x - halfW >= p.maxX - EPSILON || center.y + halfH <= p.minY + EPSILON || center.y - halfH >= p.maxY - EPSILON) return false;
  for (const axis of p.axes) {
    const at = center.x * axis.x + center.y * axis.y, radius = halfW * Math.abs(axis.x) + halfH * Math.abs(axis.y);
    if (at + radius <= axis.min + EPSILON || at - radius >= axis.max - EPSILON) return false;
  }
  return true;
}
function sweepPolygon(p, center, halfW, halfH, dx, dy, hit) {
  if (Math.max(center.x, center.x + dx) + halfW <= p.minX + EPSILON || Math.min(center.x, center.x + dx) - halfW >= p.maxX - EPSILON || Math.max(center.y, center.y + dy) + halfH <= p.minY + EPSILON || Math.min(center.y, center.y + dy) - halfH >= p.maxY - EPSILON) return;
  let enter = -Infinity, exit = Infinity, normalX = 0, normalY = 0;
  for (const axis of p.axes) {
    const at = center.x * axis.x + center.y * axis.y, velocity = dx * axis.x + dy * axis.y;
    const radius = halfW * Math.abs(axis.x) + halfH * Math.abs(axis.y);
    const min = axis.min - radius + EPSILON, max = axis.max + radius - EPSILON;
    if (Math.abs(velocity) < 1e-12) {
      if (at <= min || at >= max) return;
      continue;
    }
    const a = (min - at) / velocity, b = (max - at) / velocity, start = Math.min(a, b);
    if (start > enter) {
      enter = start;
      const sign = velocity > 0 ? -1 : 1;
      normalX = axis.x * sign;
      normalY = axis.y * sign;
    }
    exit = Math.min(exit, Math.max(a, b));
    if (enter >= exit) return;
  }
  if (exit <= 0 || enter >= hit.fraction || enter > 1) return;
  hit.fraction = Math.max(0, enter);
  hit.normalX = normalX;
  hit.normalY = normalY;
}
var NativeBodyCollision = class {
  constructor(native, map) {
    this.map = map;
    if (map.tileSize !== 8) throw new Error("Native body collision requires the original 8px navigation map");
    const roles = new Map(native.definition.instances.map((instance) => [instance.id, instance.role]));
    const solids = [];
    for (const mesh of native.meshes) {
      if (roles.get(mesh.spec.id) !== "solid") continue;
      for (let face = 0; face < mesh.indices.length; face += 3) {
        const points2 = [];
        for (let corner = 0; corner < 3; corner++) {
          const index = mesh.indices[face + corner] * 3;
          points2.push({ x: mesh.positions[index], y: mesh.positions[index + 1] });
        }
        const value = polygon(points2);
        if (value) solids.push(value);
      }
    }
    this.solids = solids;
    this.triangleCount = solids.length;
    this.cell = { points: [], axes: [{ x: 1, y: 0, min: 0, max: 0 }, { x: 0, y: 1, min: 0, max: 0 }], minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  solids;
  hit = { fraction: 1, normalX: 0, normalY: 0 };
  at = { x: 0, y: 0 };
  cell;
  triangleCount;
  supports(center, halfW, halfH) {
    if (!this.validBody(center, halfW, halfH)) return false;
    const size = this.map.tileSize;
    for (let row = Math.floor((center.y - halfH + EPSILON) / size); row <= Math.floor((center.y + halfH - EPSILON) / size); row++)
      for (let col = Math.floor((center.x - halfW + EPSILON) / size); col <= Math.floor((center.x + halfW - EPSILON) / size); col++)
        if (this.map.tiles[row][col] === 3 /* VOID */) return false;
    for (const solid of this.solids) if (overlap(solid, center, halfW, halfH)) return false;
    return true;
  }
  displacementFraction(center, halfW, halfH, dx, dy, exemption) {
    if (!this.supports(center, halfW, halfH) || !Number.isFinite(dx) || !Number.isFinite(dy)) return 0;
    return this.trace(center, halfW, halfH, dx, dy, exemption).fraction;
  }
  resolveMotion(center, halfW, halfH, dx, dy, velocity, out) {
    out.x = center.x;
    out.y = center.y;
    out.velocityX = velocity.x;
    out.velocityY = velocity.y;
    out.collided = false;
    if (!this.supports(center, halfW, halfH) || (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(velocity.x) || !Number.isFinite(velocity.y))) {
      out.velocityX = 0;
      out.velocityY = 0;
      out.collided = true;
      return;
    }
    let remainingX = dx, remainingY = dy;
    for (let iteration = 0; iteration < 4 && Math.abs(remainingX) + Math.abs(remainingY) > EPSILON; iteration++) {
      this.at.x = out.x;
      this.at.y = out.y;
      const hit = this.trace(this.at, halfW, halfH, remainingX, remainingY);
      out.x += remainingX * hit.fraction;
      out.y += remainingY * hit.fraction;
      if (hit.fraction === 1) break;
      out.collided = true;
      remainingX *= 1 - hit.fraction;
      remainingY *= 1 - hit.fraction;
      const inward = remainingX * hit.normalX + remainingY * hit.normalY;
      if (inward >= 0) break;
      remainingX -= inward * hit.normalX;
      remainingY -= inward * hit.normalY;
      const velocityInward = out.velocityX * hit.normalX + out.velocityY * hit.normalY;
      if (velocityInward < 0) {
        out.velocityX -= velocityInward * hit.normalX;
        out.velocityY -= velocityInward * hit.normalY;
      }
    }
  }
  validBody(center, halfW, halfH) {
    return Number.isFinite(center.x) && Number.isFinite(center.y) && Number.isFinite(halfW) && Number.isFinite(halfH) && halfW > 0 && halfH > 0 && center.x - halfW >= 0 && center.y - halfH >= 0 && center.x + halfW <= this.map.cols * this.map.tileSize && center.y + halfH <= this.map.rows * this.map.tileSize;
  }
  trace(center, halfW, halfH, dx, dy, exemption) {
    const hit = this.hit;
    hit.fraction = 1;
    hit.normalX = 0;
    hit.normalY = 0;
    const size = this.map.tileSize;
    const minCol = Math.max(-1, Math.floor((Math.min(center.x, center.x + dx) - halfW) / size));
    const maxCol = Math.min(this.map.cols, Math.floor((Math.max(center.x, center.x + dx) + halfW) / size));
    const minRow = Math.max(-1, Math.floor((Math.min(center.y, center.y + dy) - halfH) / size));
    const maxRow = Math.min(this.map.rows, Math.floor((Math.max(center.y, center.y + dy) + halfH) / size));
    for (let row = minRow; row <= maxRow; row++) for (let col = minCol; col <= maxCol; col++) {
      if (row >= 0 && col >= 0 && row < this.map.rows && col < this.map.cols && this.map.tiles[row][col] !== 3 /* VOID */) continue;
      const cell = this.cell;
      cell.minX = col * size;
      cell.maxX = (col + 1) * size;
      cell.minY = row * size;
      cell.maxY = (row + 1) * size;
      cell.axes[0].min = cell.minX;
      cell.axes[0].max = cell.maxX;
      cell.axes[1].min = cell.minY;
      cell.axes[1].max = cell.maxY;
      sweepPolygon(cell, center, halfW, halfH, dx, dy, hit);
    }
    for (const solid of this.solids) {
      if (exemption) for (const piece of outsideExemption(solid, exemption)) sweepPolygon(piece, center, halfW, halfH, dx, dy, hit);
      else sweepPolygon(solid, center, halfW, halfH, dx, dy, hit);
    }
    if (hit.fraction < 1) hit.fraction = Math.max(0, hit.fraction - SEPARATION / Math.max(Math.abs(dx), Math.abs(dy), SEPARATION));
    return hit;
  }
};

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/systems/tile-grid.ts
var TileGrid = class {
  cols;
  rows;
  tileSize;
  widthPx;
  heightPx;
  data;
  _version = 0;
  constructor(map) {
    this.cols = map.cols;
    this.rows = map.rows;
    this.tileSize = map.tileSize;
    this.widthPx = map.cols * map.tileSize;
    this.heightPx = map.rows * map.tileSize;
    this.data = new Uint8Array(map.cols * map.rows);
    for (let row = 0; row < map.rows; row++) {
      const sourceRow = map.tiles[row];
      if (!sourceRow || sourceRow.length !== map.cols) {
        throw new Error(`TileGrid: row ${row} does not have ${map.cols} tiles`);
      }
      for (let col = 0; col < map.cols; col++) {
        this.data[row * map.cols + col] = sourceRow[col];
      }
    }
  }
  get version() {
    return this._version;
  }
  /**
   * Returns `TileType.WALL` for out-of-bounds so callers never need bounds checks.
   * In-bounds VOID stays VOID (unwalkable; opaque via `isOpaque`).
   */
  getTile(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return 0 /* WALL */;
    return this.data[row * this.cols + col];
  }
  isOpaque(col, row) {
    const tile = this.getTile(col, row);
    return tile === 0 /* WALL */ || tile === 3 /* VOID */;
  }
  isWalkable(col, row) {
    const tile = this.getTile(col, row);
    return tile === 1 /* FLOOR */ || tile === 2 /* FRACTURE */;
  }
  /** True when the world position falls inside a walkable tile. */
  isWalkableAt(x, y) {
    return this.isWalkable(Math.floor(x / this.tileSize), Math.floor(y / this.tileSize));
  }
  /** Mutates a tile and bumps `version` so caches (vision, paths) invalidate. */
  setTile(col, row, tile) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    const index = row * this.cols + col;
    if (this.data[index] === tile) return;
    this.data[index] = tile;
    this._version++;
  }
  /** Writes the centre of a tile into `out` (no allocation). */
  tileToWorld(col, row, out) {
    out.x = col * this.tileSize + this.tileSize / 2;
    out.y = row * this.tileSize + this.tileSize / 2;
    return out;
  }
  /** Writes the tile containing a world position into `out` (no allocation). */
  worldToTile(x, y, out) {
    out.col = Math.floor(x / this.tileSize);
    out.row = Math.floor(y / this.tileSize);
    return out;
  }
};

// ../../../private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ/src/utils/grid-raycast.ts
function createRayHit() {
  return { x: 0, y: 0, dist: 0, hit: false };
}
var CORNER_MARGIN = 1;
var losScratch = createRayHit();
function castRayDirection(grid2, originX, originY, dirX, dirY, maxDist, out) {
  const tileSize = grid2.tileSize;
  let col = Math.floor(originX / tileSize);
  let row = Math.floor(originY / tileSize);
  if (grid2.isOpaque(col, row)) {
    out.x = originX;
    out.y = originY;
    out.dist = 0;
    out.hit = true;
    return out;
  }
  const stepCol = dirX > 0 ? 1 : dirX < 0 ? -1 : 0;
  const stepRow = dirY > 0 ? 1 : dirY < 0 ? -1 : 0;
  const invX = stepCol !== 0 ? 1 / Math.abs(dirX) : Infinity;
  const invY = stepRow !== 0 ? 1 / Math.abs(dirY) : Infinity;
  const deltaX = tileSize * invX;
  const deltaY = tileSize * invY;
  let nextX = stepCol > 0 ? ((col + 1) * tileSize - originX) * invX : stepCol < 0 ? (originX - col * tileSize) * invX : Infinity;
  let nextY = stepRow > 0 ? ((row + 1) * tileSize - originY) * invY : stepRow < 0 ? (originY - row * tileSize) * invY : Infinity;
  const maxSteps = grid2.cols + grid2.rows + 2;
  for (let step = 0; step < maxSteps; step++) {
    const throughVertex = stepCol !== 0 && stepRow !== 0 && Math.abs(nextX - nextY) <= CORNER_MARGIN;
    if (throughVertex) {
      const dist2 = nextX < nextY ? nextX : nextY;
      if (dist2 > maxDist) break;
      if (grid2.isOpaque(col + stepCol, row) && grid2.isOpaque(col, row + stepRow)) {
        return writeHit(out, originX, originY, dirX, dirY, dist2, true);
      }
      col += stepCol;
      row += stepRow;
      nextX += deltaX;
      nextY += deltaY;
      if (grid2.isOpaque(col, row)) {
        return writeHit(out, originX, originY, dirX, dirY, dist2, true);
      }
      continue;
    }
    let dist;
    if (nextX < nextY) {
      dist = nextX;
      if (dist > maxDist) break;
      col += stepCol;
      nextX += deltaX;
    } else {
      dist = nextY;
      if (dist > maxDist) break;
      row += stepRow;
      nextY += deltaY;
    }
    if (grid2.isOpaque(col, row)) {
      return writeHit(out, originX, originY, dirX, dirY, dist, true);
    }
  }
  return writeHit(out, originX, originY, dirX, dirY, maxDist, false);
}
function hasLineOfSight(grid2, from, to, maxDist) {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  if (length < 1e-6) {
    return !grid2.isOpaque(Math.floor(from.x / grid2.tileSize), Math.floor(from.y / grid2.tileSize));
  }
  if (maxDist !== void 0 && length > maxDist) return false;
  castRayDirection(grid2, from.x, from.y, deltaX / length, deltaY / length, length, losScratch);
  return !losScratch.hit || losScratch.dist >= length - 1e-3;
}
function writeHit(out, originX, originY, dirX, dirY, dist, hit) {
  out.x = originX + dirX * dist;
  out.y = originY + dirY * dist;
  out.dist = dist;
  out.hit = hit;
  return out;
}

// docs/qa/artifacts/r100-i10-i12/controlled-matrices-final108/sources/tools/qa/check-r100-cross-world-capabilities.ts
var planFile = "docs/qa/artifacts/r100-i10-i12/qualification-plan.json";
var plan = JSON.parse(readFileSync(planFile, "utf8"));
var matrix = plan.i11ContractMatrix;
assert(matrix, "frozen plan must contain the cross-world matrix");
var hash = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
assert.equal(hash(planFile), "d493aeb9d26b4758c90434c8c5a8cdfb74fb581800a2c37a50ae3b2eb91f0c25");
assert.equal(hash(matrix.abilitySource.path), matrix.abilitySource.sha256);
var definitions = Object.values(CATALOG_ITEMS).filter((row) => row.class === "core" && row.grade === 1);
assert.deepEqual(definitions.map((row) => row.familyId).sort(), [...matrix.abilityFamilies].sort());
var topologies = ["open", "occluded", "void", "solid"];
var rows = [];
var graphicCalls = 0;
var observedSweeps = 0;
var refusedTargets = 0;
var negativeChecks = 0;
var graphic = new Proxy({}, { get: (_target, name) => (...args) => {
  for (const value of args) if (typeof value === "number") assert(Number.isFinite(value), `nonfinite graphic ${String(name)}`);
  graphicCalls++;
  return graphic;
} });
var scene = { add: { graphics: () => graphic } };
var versions = { catalogVersion: "contaminant-v1", lootAlgorithmVersion: 1, combatRulesVersion: 2 };
function geometry(angle, topology) {
  const origin = { x: 320, y: 320 }, direction = { x: Math.cos(angle), y: Math.sin(angle) };
  const point = (forward, side = 0) => ({
    x: origin.x + direction.x * forward - direction.y * side,
    y: origin.y + direction.y * forward + direction.x * side
  });
  const barrier = [point(32, -120), point(40, -120), point(40, 120), point(32, 120)];
  const inBand = (x, y) => {
    const forward = (x - 320) * direction.x + (y - 320) * direction.y;
    const side = -(x - 320) * direction.y + (y - 320) * direction.x;
    return forward >= 32 && forward <= 40 && Math.abs(side) <= 120;
  };
  const map = { tileSize: 8, rows: 80, cols: 80, tiles: Array.from({ length: 80 }, (_, r) => Array.from({ length: 80 }, (_2, c) => inBand(c * 8 + 4, r * 8 + 4) ? topology === "void" ? 3 /* VOID */ : topology === "solid" || topology === "occluded" ? 0 /* WALL */ : 1 /* FLOOR */ : 1 /* FLOOR */)) };
  const native = {
    definition: { instances: topology === "solid" ? [{ id: 1, role: "solid" }] : [] },
    meshes: topology === "solid" ? [{ spec: { id: 1 }, positions: barrier.flatMap((p) => [p.x, p.y, 12]), indices: [0, 1, 2, 0, 2, 3] }] : []
  };
  const grid2 = new TileGrid(map), body = new NativeBodyCollision(native, map);
  assert(body.supports(origin, 10, 10));
  const visible = (p) => hasLineOfSight(grid2, origin, p);
  return { origin, direction, point, grid: grid2, body, visible };
}
for (const degrees of matrix.orientationsDegrees) for (const phase of matrix.normalizedAnimationPhases) {
  const angle = degrees * Math.PI / 180;
  for (const topology of topologies) for (const definition of definitions) {
    const ability = getCatalogAbilityByDefinition(definition.id, "contaminant-v1");
    const label = `${ability.familyId}/${degrees}/${phase}/${topology}`;
    const { origin, direction, point, grid: grid2, body, visible } = geometry(angle, topology);
    const initial = { ...origin }, enemy = point(64), controls = new EnemyControlState();
    controls.setControlProtectionEnabled(true);
    const environment = new EnvironmentHazardControl();
    let commits = 0, sounds = 0, applications = 0, input = true;
    const decoys = /* @__PURE__ */ new Map();
    const counts = () => ({ commits, sounds, applications });
    const connected = (from, to, range) => collectToolRevealSnapshot(from, range, grid2, [to], [], void 0, body).enemyPositions.length > 0;
    const runtime = new CatalogAbilityRuntime(scene, () => origin, () => [
      { getId: () => "target", getPosition: () => enemy, getState: () => "patrol" /* PATROL */ }
    ], {
      runId: label,
      combatRulesVersion: 2,
      getFacingAngle: () => angle,
      isTargetAlive: () => true,
      isTargetVisible: visible,
      hasTargetLineOfSight: (a, b) => hasLineOfSight(grid2, a, b),
      canApplyHardControl: () => controls.canApplyHardControl(),
      setEnemyControl: (_id, source, effect) => controls.set(source, effect),
      hasEnemyControl: (_id, source) => controls.has(source),
      clearEnemyControl: (_id, source) => {
        controls.clear(source);
      },
      getBasePollutionResistance: () => 0,
      getDashDestination: (distance) => sweepGroundDash({ origin, destination: point(distance), grid: grid2, bodyQueries: body, isVisible: visible }),
      advanceGroundDash: (target) => {
        const destination = sweepGroundDash({ origin, destination: target, grid: grid2, bodyQueries: body });
        assert(Math.hypot(destination.x - target.x, destination.y - target.y) < 1e-3, `${label}: every active dash substep supported`);
        Object.assign(origin, destination);
        assert(body.supports(origin, 10, 10));
        observedSweeps++;
        return true;
      },
      isGroundConnected: connected,
      getSoundLureDestination: (distance) => findSoundLureLanding(origin, direction, distance, grid2, 16, body),
      reportSoundLure: () => {
        sounds++;
      },
      getStitchPlacement: (length, distance) => findStitchPlacement(origin, direction, distance, length, grid2, (a, b) => hasLineOfSight(grid2, a, b)),
      setPlayerInput: (enabled) => {
        input = enabled;
      },
      getEnvironmentTargets: () => [{ id: "host", position: enemy, canSuppressHazard: !environment.suppressed }],
      suppressEnvironmentHazard: (_id, source, duration) => {
        environment.suppress(source, duration);
        applications++;
        return true;
      },
      clearEnvironmentControl: (_id, source) => environment.clear(source),
      getRevealSnapshot: (range) => collectToolRevealSnapshot(origin, range, grid2, [enemy], [point(20), point(96)], void 0, body),
      showAbyssReveal: () => {
      },
      setVisualDecoy: (source, p) => {
        if (p) decoys.set(source, { ...p });
        else decoys.delete(source);
      }
    });
    const row = { label, family: ability.familyId, definitionId: definition.id, degrees, phase, topology };
    if (ability.slot === "passive") {
      const inventory = new InventoryStore();
      inventory.configure({ weaponDefinition: (id) => WEAPON_DATA[id], starterDefinitionId: "crowbar_plain" });
      assert(inventory.ensureStarter().ok);
      const item = createCatalogContaminant({ id: label, definitionId: definition.id, appearanceId: "wax_parcel", offeringProfileId: "resist_35", quality: "ordinary", acquiredOrdinal: 0 });
      for (const result2 of [
        inventory.addContaminant(item),
        inventory.slotOffering(item.id, 0),
        inventory.finishOfferingImpact([item.id], 3, {}, `reveal:${label}`),
        inventory.prepareTool(item.id, 2),
        inventory.beginRun(label, versions)
      ]) assert(result2.ok, label);
      const saved = inventory.getState(), receipt = saved.run.passiveReceipts[0];
      assert.equal(receipt.familyId, ability.familyId);
      assert.equal(receipt.definitionId, definition.id);
      assert(receipt.benefit > 0);
      assert(!runtime.use(ability, item.id, () => {
        commits++;
        return true;
      }));
      assert.equal(commits, 0);
      const restored = new InventoryStore();
      restored.configure({ weaponDefinition: (id) => WEAPON_DATA[id], starterDefinitionId: "crowbar_plain" });
      assert(restored.loadState(JSON.parse(JSON.stringify(saved))));
      assert.deepEqual(restored.getState(), saved);
      assert.equal(restored.getCapacity(), inventory.getCapacity());
      row.receipt = receipt;
      row.accepted = "passive-at-departure";
      row.continuationExact = true;
    } else {
      if (topology === "open" && ["solidify", "suppress"].includes(ability.familyId)) {
        Object.assign(enemy, point(-64));
        assert.equal(runtime.getTargetPreview(ability), null, `${label}: a target behind cannot be selected`);
        assert(!runtime.use(ability, "owned-item", () => {
          commits++;
          return true;
        }, "behind"));
        assert.equal(commits, 0);
        Object.assign(enemy, point(64));
        negativeChecks++;
      }
      const preview = runtime.getTargetPreview(ability);
      const accepted = runtime.use(ability, "owned-item", () => {
        commits++;
        return true;
      }, "use:1");
      if (topology === "open") assert(accepted, label);
      if (["solidify", "suppress"].includes(ability.familyId) && topology !== "open") {
        assert(!visible(enemy), `${label}: fixture must actually occlude`);
        assert(!accepted, label);
        refusedTargets++;
      }
      if (["solidify", "suppress", "dash", "sound_lure", "tripwire", "slow_zone"].includes(ability.familyId)) assert.equal(accepted, preview !== null, `${label}: preview/commit disagree`);
      assert.equal(commits, Number(accepted));
      if (accepted) {
        assert(!runtime.use(ability, "owned-item", () => {
          commits++;
          return true;
        }, "use:1"));
        const dt = ability.durationMs * phase;
        if (dt > 0) {
          controls.tick(dt);
          environment.tick(dt);
          runtime.update(dt);
        }
        const saved = JSON.parse(JSON.stringify(runtime.exportRuntimeState()));
        assert(validateCatalogAbilityRuntimeState(saved), label);
        assert.equal(saved.elapsedMs, dt);
        assert.equal(saved.effects[0].remainingTime, ability.durationMs - dt);
        const before = counts(), beforePosition = { ...origin }, host = environment.exportRuntimeState();
        for (let i = 0; i < 3; i++) assert.deepEqual(runtime.exportRuntimeState(), saved);
        controls.beginRuntimeRestore();
        runtime.restoreRuntimeState(saved);
        assert.deepEqual(runtime.exportRuntimeState(), saved, label);
        assert.deepEqual(counts(), before);
        assert.deepEqual(origin, beforePosition);
        assert.deepEqual(environment.exportRuntimeState(), host);
        const forged = structuredClone(saved);
        forged.effects[0].resolvedParams.paramValue += 1;
        assert(!validateCatalogAbilityRuntimeState(forged));
        negativeChecks++;
        row.activeEffect = saved.effects[0];
        row.continuationExact = true;
        controls.tick(17);
        environment.tick(17);
        runtime.update(17);
        const advanced = runtime.exportRuntimeState();
        assert.equal(advanced.elapsedMs, dt + 17);
        assert.equal(advanced.effects[0].remainingTime, ability.durationMs - dt - 17);
        assert.deepEqual(counts(), before, `${label}: continued effect must not replay payment or one-shot sound`);
        if (ability.familyId === "dash") {
          assert(body.supports(origin, 10, 10));
          row.actualTravel = Math.hypot(origin.x - initial.x, origin.y - initial.y);
          if (topology === "solid" || topology === "void") assert(row.actualTravel < 32, label);
        }
      } else assert.equal(runtime.exportRuntimeState().effects.length, 0);
      row.accepted = accepted;
      row.commits = commits;
    }
    runtime.destroy();
    assert(input, `${label}: dash teardown restores input`);
    assert.equal(decoys.size, 0);
    rows.push(row);
  }
}
assert.equal(rows.length, 12 * 8 * 4 * 4);
assert.equal(new Set(rows.map((row) => row.label)).size, 1536, "Every ability/direction/phase/topology combination must be unique");
var expectedKeys = matrix.abilityFamilies.flatMap((family) => matrix.orientationsDegrees.flatMap((degrees) => matrix.normalizedAnimationPhases.flatMap((phase) => topologies.map((topology) => `${family}/${degrees}/${phase}/${topology}`))));
assert.deepEqual(rows.map((row) => row.label).sort(), expectedKeys.sort());
assert(observedSweeps > 0 && refusedTargets > 0 && negativeChecks > 0);
var output = process.argv[2];
var result = {
  status: "pass",
  kind: "controlled real runtime contracts, not normal game play or rendered art",
  scope: "All 12 authored ordinary core families; eight directions; four active-effect lifecycle phases; open/optically occluded/real VOID/solid triangle fixtures. Pause is a no-tick contract, not a browser pause-key test. Ground remains invariant under effect clocks. Environment lighting animation is separately reviewed in normal three-grade footage.",
  plan: { path: planFile, sha256: hash(planFile) },
  source: { path: "tools/qa/check-r100-cross-world-capabilities.ts", sha256: hash("tools/qa/check-r100-cross-world-capabilities.ts") },
  abilitySource: matrix.abilitySource,
  counts: { cases: rows.length, graphicCalls, observedSweeps, refusedTargets, negativeChecks },
  rows
};
if (output) writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ status: result.status, ...result.counts }));
