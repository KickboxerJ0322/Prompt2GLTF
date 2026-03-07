# Prompt2GLTF Skill

`prompt2gltf` は、自然言語のプロンプトから 3D モデル仕様を生成し、`gltf/glb` とプレビュー HTML を出力するローカルスキルです。

## このスキルでできること

- ユーザーのプロンプトを解釈して、subject・スケール・スタイル・形状方針を推定
- 高密度な `spec.json` を生成
- `model.gltf` と `model.glb` を生成
- 確認用の `preview.html` を生成

## 出力先

出力はすべて次のディレクトリに保存されます。

`generated/prompt2gltf/`

- `spec.json`
- `model.gltf`
- `model.glb`
- `preview.html`

## 使い方

プロジェクトルートで以下を実行します。

```bash
node tools/prompt2gltf/src/index.mjs --prompt "ここにプロンプト"
```

例:

```bash
node tools/prompt2gltf/src/index.mjs --prompt "2階建てアパート"
```

## 対応カテゴリ

- `building`（戸建て、アパート、マンション、大邸宅 など）
- `vehicle`（鉄道/道路/海上/航空、パトカー、タクシー、スポーツカー、軽自動車、トラック など）
- `castle`（魔王城、シンデレラ城、日本風の城、クリスタルタワー など）
- `structure`（木、信号、歩道橋、橋、データセンター、テーマパーク、発電所、ロケット基地 など）
- 既存タイプ: `giant`, `robot`, `tower`, `airship`, `kaiju`, `warrior`

## モデリング方針

- `box` だけでなく `cylinder` / `sphere` / `tri_prism` を併用
- 丸みのある対象は曲面プリミティブで形状を反映
- JSON の情報量（parts / details の密度）は落とさない

## 主なファイル

- スキル定義: `.claude/skills/prompt2gltf/SKILL.md`
- 生成ロジック: `tools/prompt2gltf/src/index.mjs`
