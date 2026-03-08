---
name: prompt2gltf
description: Generate a high-density 3D specification JSON from a user's prompt, then build GLTF/GLB and a preview HTML. Best for requests like "100m級の巨人を作って", "巨大ロボを作って", or "城を作って".
---

# Prompt2GLTF

## Purpose
Turn a user's natural language prompt into:
1. a large structured 3D spec JSON
2. a procedurally generated `.gltf`
3. a procedurally generated `.glb`
4. a lightweight `preview.html`

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

## Output location
Write generated files under:

generated/prompt2gltf/

Expected files:
- generated/prompt2gltf/spec.json
- generated/prompt2gltf/model.gltf
- generated/prompt2gltf/model.glb
- generated/prompt2gltf/preview.html

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
3. Run the local generator:

   node plugins/prompt2gltf/scripts/index.mjs --prompt "<USER_PROMPT>"

4. After generation, summarize:
   - what was inferred
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
- human (人間全般: police_officer / firefighter / nurse / doctor / child / elderly / woman / adult)
- vehicle (generic transport)
- structure (tree / signal / bridge / infra)

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

- 3D仕様JSONを生成しました
- GLTF / GLB / Preview を出力しました
- 出力先: generated/prompt2gltf/

## Failure handling
If generation fails:
- explain the failed step briefly
- show the exact command attempted
- propose the next corrective action
