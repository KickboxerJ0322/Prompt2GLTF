---
name: prompt2gltf
description: Generate a high-density 3D specification JSON from a user's prompt, then build GLTF/GLB. Best for requests like "戸建て住宅を作って", "タワーを作って", "100m級の巨人を作って", "巨大ロボを作って", or "城を作って".
---

# prompt2gltf

## Purpose
Turn a user's natural language prompt into:
1. a large structured 3D spec JSON
2. a procedurally generated `.gltf`
3. a procedurally generated `.glb`

## When to use
Use this skill when the user asks to:
- create a 3D model from text
- generate a giant / robot / castle / statue / fantasy structure
- export GLTF or GLB from a natural-language concept

## Important behavior
- Do NOT directly improvise arbitrary glTF JSON as the first step.
- Always convert the prompt into a structured internal spec first.
- Prefer original generalized styles over copyrighted named-character replication.
- Keep outputs deterministic and file-based.
- Geometry directive: do not rely on rectangular boxes only. Use mixed primitives (box / cylinder / sphere / triangular prism) and preserve real-world roundness/curvature when the subject has curved forms.
- Keep overall JSON richness at least the current level (do not reduce part/detail metadata density).
- **Never generate preview.html.**

## Output location
Write generated files under:

generated/

Expected files:
- generated/model_spec.json
- generated/model.gltf
- generated/model.glb

## Template reference
Templates are stored in `plugins/prompt2gltf/templates/`. Each template is a full spec JSON for a representative subject.

**Before running the generator:**
1. List `plugins/prompt2gltf/templates/` to see available templates.
2. Read each template's `promptInterpretation.normalizedSubject` and `meta.name`.
3. Pick the template whose subject / style best matches the user's prompt.
4. Pass it via `--template templates/<filename>` to the generator command.

**Template matching guide:**
| Template file          | normalizedSubject | Good for                            |
|------------------------|-------------------|-------------------------------------|
| godzilla_spec.json     | kaiju             | 怪獣, 巨大生物, モンスター          |
| tsutenkaku_spec.json   | tower             | タワー, 塔, 電波塔, 観光塔          |
| datacenter_spec.json   | structure         | 建物, 工場, 施設, データセンター     |
| police_station.json    | building          | 警察署, 交番, 警察施設              |
| fire_station.json      | building          | 消防署, 消防局, 消防施設            |
| nursing_home_100bed.json | building        | 老人ホーム, 特養, 介護施設, 100床   |
| pedestrian_bridge.json   | structure       | 歩道橋, 陸橋, 横断歩道橋            |
| convenience_store.json   | building        | コンビニ, コンビニエンスストア, セブンイレブン, ローソン, ファミリーマート |
| gas_station.json         | building        | ガソリンスタンド, 給油所, エネオス, 出光, コスモ石油               |
| spherical_gas_holder.json | structure      | 球形ガスホルダー, ガスタンク, 球形タンク, 高圧ガスタンク, 都市ガス貯蔵施設 |
| lighthouse.json           | structure      | 灯台, 海上灯台, 沿岸灯台, lighthouse                                       |
| gorilla.json              | animal         | ゴリラ, 類人猿, 大型類人猿, 西ローランドゴリラ                             |
| giraffe.json              | animal         | キリン, 麒麟, アミメキリン, マサイキリン                                   |
| ufo.json                  | ufo            | UFO, ユーフォー, 空飛ぶ円盤, 未確認飛行物体, flying saucer                 |
| slime.json                | slime          | スライム, ooze, blob, ゼリー状怪物, 粘液モンスター                         |
| world_tree.json           | world_tree     | 世界樹, ユグドラシル, Yggdrasil, イグドラシル, 神話の大樹, 北欧神話の樹    |
| luxury_cruise_ship.json   | vehicle/marine | 豪華客船, クルーズ船, 客船, 大型クルーズ, セレブリティ, エッジクラス, ocean liner, cruise ship |

If no template closely matches, omit `--template` (the generator builds from scratch).

**Note:** dragon has no saved template yet — always omit `--template` for dragon.

## Workflow
When invoked:

1. Read the user's request and normalize it into a design concept.
2. Infer:
   - subject type
   - scale
   - style
   - silhouette
   - materials
   - accessories
   - pose
3. Select the best matching template from `plugins/prompt2gltf/templates/` (see Template reference above).
4. Run the local generator with the selected template:

   node plugins/prompt2gltf/scripts/index.mjs --prompt "<USER_PROMPT>" --template templates/<BEST_MATCH>.json

   If no template matches:

   node plugins/prompt2gltf/scripts/index.mjs --prompt "<USER_PROMPT>"

5. After generation, summarize:
   - what was inferred
   - which template was used (if any)
   - where files were written
   - any simplifications made

## Supported subjects
- giant
- robot
- castle
- tower
- airship
- kaiju
- warrior
- building (generic architecture: house / apartment / mansion / campus)
- building / facility_hospital (病院・診療所)
- building / facility_police (警察署)
- building / facility_fire (消防署)
- building / facility_nursing (老人ホーム・介護施設)
- building / facility_school (学校)
- building / facility_cityhall (市役所・区役所)
- building / facility_university (大学・キャンパス)
- human (男性 / 女性 / 子ども)
- vehicle (generic transport)
- structure (tree / signal / bridge / infra)
- structure / spherical_gas_holder (球形ガスホルダー・高圧ガスタンク)
- structure / lighthouse (灯台・海上灯台)
- ufo (空飛ぶ円盤・未確認飛行物体・flying saucer)
- dragon (ドラゴン・竜・龍・ワイバーン) ※ スタイル: fire/ice/poison/dark/classic
- slime (スライム・ooze・blob・ゼリー状怪物) ※ スタイル: green/red/blue/purple/yellow/black/giant
- animal / gorilla (ゴリラ・類人猿)
- animal / giraffe (キリン・麒麟)
- animal / lion (ライオン・獅子)

## Prompt interpretation rules
### giant
Map phrases like:
- 巨人
- 100m級
- 神話的
- ダークファンタジー
- 守護者
to a humanoid colossus spec.

### robot
Map phrases like:
- ロボ
- メカ
- 機械
- 未来兵器
to a mechanical humanoid spec.

### castle
Map phrases like:
- 城
- 要塞
- 神殿
- 王国の建造物
to a large architectural spec.

## Safety / copyright rule
If the user references a copyrighted named character or franchise-specific design,
translate it into a generalized original style instead of exact reproduction.

Example:
- "進撃の巨人そのもの" -> "超大型の不気味な人型巨人風"
- "ガンダムそのもの" -> "白・青・赤系のヒロイック巨大ロボ風"

## Success message format
Return a short result summary like:

- テンプレート: templates/godzilla_spec.json を使用
- 3D仕様JSONを生成しました
- GLTF / GLB を出力しました
- 出力先: generated/

## Failure handling
If generation fails:
- explain the failed step briefly
- show the exact command attempted
- propose the next corrective action
