# Prompt2GLTF Skill

`prompt2gltf` は、自然言語のプロンプトから 3D モデル仕様を生成し、`gltf/glb` とプレビュー HTML を出力するローカルスキルです。

## このスキルでできること

- ユーザーのプロンプトを解釈して、subject・スケール・スタイル・形状方針を推定
- 高密度な `spec.json` を生成
- `model.gltf` と `model.glb` を生成
- 確認用の `preview.html` を生成

---

## 使い方

### 事前準備

#### 1. Node.js のインストール

このスキルは **Node.js (v18 以上)** が必要です。

1. [Node.js 公式サイト](https://nodejs.org/) にアクセスし、**LTS 版**をダウンロードしてインストールしてください。
2. インストール後、ターミナル（PowerShell / コマンドプロンプト / Git Bash）で以下を実行して確認します。

   ```bash
   node --version
   ```

   `v18.x.x` 以上が表示されれば OK です。

#### 2. 依存パッケージのインストール

プロジェクトルートで以下を実行してください。

```bash
cd plugins/prompt2gltf
npm install
```

> `node_modules/` フォルダが作成されれば成功です。

#### 3. (任意) Claude Code のインストール

このスキルは Claude Code のスキル機能（`/prompt2gltf`）から呼び出すことを前提にしています。
Claude Code をまだインストールしていない場合は、以下を参照してください。

- [Claude Code 公式ページ](https://claude.ai/claude-code)
- インストール後、プロジェクトルートで `claude` コマンドを実行するだけで使えます。

---

### 実行方法

#### Claude Code スキルから呼び出す（推奨）

Claude Code を起動した状態で、チャット欄に以下のように入力します。

```
/prompt2gltf 消防士を作って
/prompt2gltf 病院を作って
/prompt2gltf 2階建てアパートを作って
/prompt2gltf 100m級の巨人を作って
```

スキルが自動的にプロンプトを解釈し、生成ロジックを呼び出します。

#### コマンドラインから直接実行

```bash
node plugins/prompt2gltf/scripts/index.mjs --prompt "ここにプロンプト"
```

例:

```bash
node plugins/prompt2gltf/scripts/index.mjs --prompt "警察署"
node plugins/prompt2gltf/scripts/index.mjs --prompt "消防士"
node plugins/prompt2gltf/scripts/index.mjs --prompt "看護師"
node plugins/prompt2gltf/scripts/index.mjs --prompt "3階建て学校"
node plugins/prompt2gltf/scripts/index.mjs --prompt "市役所"
node plugins/prompt2gltf/scripts/index.mjs --prompt "2階建てアパート"
```

---

## 出力先

出力はすべて次のディレクトリに保存されます。

```
generated/prompt2gltf/
```

| ファイル | 内容 |
|---|---|
| `spec.json` | 高密度な 3D 仕様 JSON |
| `model.gltf` | GLTF 形式の 3D モデル |
| `model.glb` | GLB (バイナリ) 形式の 3D モデル |
| `preview.html` | ブラウザで確認できるプレビュー |

> `preview.html` をブラウザで開くと Three.js ベースの 3D ビューアで確認できます。

---

## 対応カテゴリ

### 建物・施設

| カテゴリ | 例 |
|---|---|
| `building` (一般建築) | 戸建て、アパート、マンション、大邸宅 |
| `facility_hospital` (病院・診療所) | 病院、診療所、クリニック |
| `facility_police` (警察署) | 警察署 |
| `facility_fire` (消防署) | 消防署 |
| `facility_nursing` (老人ホーム) | 老人ホーム、介護施設 |
| `facility_school` (学校) | 小学校、中学校、高校 |
| `facility_cityhall` (市役所) | 市役所、区役所、町役場 |
| `campus` (キャンパス) | 大学、キャンパス |

### 人物

| カテゴリ | 例 |
|---|---|
| `human` (人間全般) | 大人、女性、男性 |
| `police_officer` (警察官) | 警察官、警官 |
| `firefighter` (消防士) | 消防士 |
| `nurse` (看護師) | 看護師 |
| `doctor` (医師) | 医師、ドクター |
| `child` (子ども) | 子ども、子供、小学生 |
| `elderly` (老人) | 老人、高齢者 |

### その他

| カテゴリ | 例 |
|---|---|
| `vehicle` | 鉄道、自動車、パトカー、航空機、船 |
| `castle` | 魔王城、シンデレラ城、日本の城 |
| `structure` | 木、信号、歩道橋、橋、データセンター |
| `giant` | 巨人、モアイ |
| `robot` | ロボット、メカ |
| `tower` | タワー、スカイツリー |
| `airship` | 飛行船 |
| `kaiju` | 怪獣 |
| `warrior` | 戦士、騎士 |

---

## モデリング方針

- `box` だけでなく `cylinder` / `sphere` / `tri_prism` を併用
- 丸みのある対象は曲面プリミティブで形状を反映
- JSON の情報量（parts / details の密度）は落とさない
- 施設建物には施設固有の構造物（十字マーク・サイレン灯・大扉・ポルティコ）を追加
- 人物モデルは骨格プロポーションに基づいた多パーツ構成

---

## 主なファイル

| ファイル | 役割 |
|---|---|
| `.claude-plugin/marketplace.json` | プラグイン一覧（ハッカソン用マーケットプレイス定義） |
| `plugins/prompt2gltf/.claude-plugin/plugin.json` | プラグイン定義 |
| `plugins/prompt2gltf/skills/prompt2gltf/SKILL.md` | スキル定義（Claude Code が読む） |
| `plugins/prompt2gltf/scripts/index.mjs` | 生成ロジック本体 |
| `plugins/prompt2gltf/package.json` | npm 設定 |
| `generated/prompt2gltf/` | 生成物の出力先 |

---

## 出力結果（サマリー）

> 以下は出力サンプルの画像です（準備中）。

<!-- 画像サンプル1 -->
<!--![サンプル1](docs/01_sample1.png)-->

<!-- 画像サンプル2 -->
<!--![サンプル2](docs/02_sample2.png)-->

<!-- 画像サンプル3 -->
<!--![サンプル3](docs/03_sample3.png)-->

<!-- 画像サンプル4 -->
<!--![サンプル4](docs/04_sample4.png)-->

---

## 動画

> 解説動画は準備中です。

<!-- [![Prompt2GLTF 解説動画](https://img.youtube.com/vi/PLACEHOLDER/0.jpg)](https://www.youtube.com/watch?v=PLACEHOLDER) -->
