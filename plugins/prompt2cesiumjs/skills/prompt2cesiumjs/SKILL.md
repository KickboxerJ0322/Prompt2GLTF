---
name: prompt2cesiumjs
description: 自然文から Cesium Sandcastle 用 JavaScript を生成する。Google Photorealistic 3D Tiles、GLTF/GLBモデル、移動ルート、固定配置、追尾カメラ付きコードを出力する。
---

# Prompt2Cesium

この Skill は自然文から Cesium Sandcastle 用 JavaScript を生成する。

生成されるコードは、https://sandcastle.cesium.com/ にそのまま貼り付けて実行できる JavaScript とする。

## 主目的

ユーザーの自然文指示から、次のいずれかのコードを生成する。

- ルートに沿ってモデルが移動するコード
- 3D マップ上に glTF / glb モデルを固定配置するコード

生成コードには必要に応じて次を含める。

- Cesium Viewer 初期化
- Google Photorealistic 3D Tiles の読み込み
- GLTF / GLB モデル表示
- route2D 移動ルート
- SampledPositionProperty による移動
- VelocityOrientationProperty による回転
- 追尾カメラ
- 固定配置用の位置・向き設定
- 開始地点ラベル
- 終了地点ラベル
- 経由地点ラベル
- ルートポリライン表示

出力時には次のリンク先を案内すること。

- 次のリンク先のサイトへsandcastle.jsをコピー＆ペーストしてください。https://sandcastle.cesium.com/

## テンプレートルール

必ず次のテンプレート構造をベースにコードを生成する。

- templates/sandcastle_walk_follow.js
- templates/sandcastle_drone_follow.js
- templates/sandcastle_place_model.js

ユーザー指定が無い場合は walk_follow テンプレートを使用する。

## モード選択ルール

### walk_follow を使う条件

次の語句が含まれる場合は walk_follow を使う。

- 後ろから追尾
- 歩く
- 人が歩く
- 真後ろ
- 散歩
- ルートに沿って移動

### drone_follow を使う条件

次の語句が含まれる場合は drone_follow を使う。

- ドローン視点
- 少し上から
- 上空から
- ドローン
- 上から追尾

### place_model を使う条件

次の語句が含まれる場合は place_model を使う。

- gltf を地図に置く
- glb を配置する
- 建物モデルを設置
- 家を置く
- 病院モデルを置く
- 3Dマップにモデルを表示
- gltf を固定表示
- モデルを特定地点に設置
- 建物を地図に配置
- 移動しないモデル
- 固定配置
- その場に置く

固定配置モードでは route2D を使う移動コードは生成しない。

## route2D 形式

移動モードでは route2D を必ず次の形式で定義する。

    [秒, 経度, 緯度]

例:

    [
      [0, 139.7476, 35.6672],
      [20, 139.7464, 35.6645],
      [40, 139.7442, 35.6622]
    ]

時間は秒である。

## ラベル

必要に応じて次を生成する。

- 開始地点ラベル
- 終了地点ラベル
- 経由地点ラベル
- 固定配置モデルの名称ラベル

## ルート作成ポリシー

移動モードでは、地図 API を使用しない場合でも、不自然な直線 1 本のルートは作らない。

可能な限り道路に沿うように、複数の route2D 点を生成する。

原則は次のとおり。

- 市街地徒歩ルートは 5〜12 点程度
- 短距離ルートは 4〜8 点程度
- 秒数は単調増加
- 高さは PERSON.heightMeters を使用する

## 移動モードのモデル設定ポリシー

移動コードには必ず次の PERSON 設定を含める。

### walk_follow のデフォルト値

    const PERSON = {
      name: "...",
      glb: "https://raw.githubusercontent.com/KickboxerJ0322/Prompt2GLTF/master/glb/car.glb",
      scale: 2,
      minimumPixelSize: 64,
      maximumScale: 20,
      heightMeters: 40,
      speedMultiplier: 2,
      pathWidth: 4,
      followOffset: new Cesium.Cartesian3(-540.0, -2.0, 300.0),
      lookOffset: new Cesium.Cartesian3(0.0, 0.0, 2.2),
      cameraSmooth: 0.10
    };

`MODEL_URL` が未指定のときは `https://raw.githubusercontent.com/KickboxerJ0322/Prompt2GLTF/master/glb/car.glb` を使う。

### drone_follow のデフォルト値

    const PERSON = {
      name: "...",
      glb: "https://raw.githubusercontent.com/KickboxerJ0322/Prompt2GLTF/master/glb/heli.glb",
      scale: 4.0,
      minimumPixelSize: 48,
      maximumScale: 600,
      heightMeters: 350,
      speedMultiplier: 2,
      pathWidth: 3,
      followOffset: new Cesium.Cartesian3(-250, 0, 70),
      lookOffset: new Cesium.Cartesian3(100, 0, 0),
      cameraSmooth: 0.06
    };

`MODEL_URL` が未指定のときは `https://raw.githubusercontent.com/KickboxerJ0322/Prompt2GLTF/master/glb/heli.glb` を使う。

## 移動モードのモデルスケール基準

ユーザー指定が無い場合は次を基準にする。

- 人型: scale 0.3〜2.2
- 動物: scale 0.3〜3.0
- 車: scale 1.0〜2.5
- 巨大モデル: scale 3.0 以上

## 固定配置モード

この Skill は、移動ルート付きのキャラクターコードだけでなく、3D マップ上に glTF / glb モデルを固定配置する Cesium Sandcastle JavaScript も生成できる。

固定配置モードでは次のテンプレートを使用する。

- templates/sandcastle_place_model.js

このテンプレートは Cesium Sandcastle にそのまま貼れる JavaScript コードを生成するためのもの。

## 固定配置モードの置換タグ

固定配置テンプレートには次の置換タグが含まれている。  
Skill はユーザー入力を元にこれらを埋める。

- {{DESCRIPTION}}
- {{MODEL_NAME}}
- {{MODEL_URL}}
- {{LAT}}
- {{LON}}
- {{HEIGHT}}
- {{HEADING_DEG}}
- {{PITCH_DEG}}
- {{ROLL_DEG}}
- {{SCALE}}
- {{MINIMUM_PIXEL_SIZE}}
- {{MAXIMUM_SCALE}}
- {{LABEL_TEXT}}
- {{CAMERA_HEIGHT}}
- {{CAMERA_HEADING_DEG}}
- {{CAMERA_PITCH_DEG}}
- {{FLY_DURATION}}
- {{LOG_LABEL}}

## 固定配置モードのデフォルト値

ユーザーが指定しない場合は次を使う。

`MODEL_URL` が未指定のときは `https://raw.githubusercontent.com/KickboxerJ0322/Prompt2GLTF/master/glb/tower.glb` を使う。

    HEIGHT = 40
    HEADING_DEG = 0
    PITCH_DEG = 0
    ROLL_DEG = 0

    SCALE = 2.0
    MINIMUM_PIXEL_SIZE = 96
    MAXIMUM_SCALE = 300

    CAMERA_HEIGHT = 1200
    CAMERA_HEADING_DEG = 0
    CAMERA_PITCH_DEG = -89
    FLY_DURATION = 1.8

## モデルURLルール

GitHub の URL が次の形式の場合

    https://github.com/USER/REPO/blob/main/path/model.gltf

直接取得可能な raw URL に変換して使用する。

    https://raw.githubusercontent.com/USER/REPO/main/path/model.gltf

理由:
Cesium の model.uri は直接取得可能なファイル URL である必要があるため。

## 固定配置モードのカメラルール

初期カメラはモデル中心を見る。

    Cesium.Cartesian3.fromDegrees(lon, lat, CAMERA_HEIGHT)

基本は、ほぼ真上からの視点とする。

    CAMERA_PITCH_DEG = -89

## 固定配置モードの必須コード構造

固定配置コードには必ず次を含める。

1. Cesium Viewer 初期化
2. Google Photorealistic 3D Tiles 読み込み

       await Cesium.createGooglePhotorealistic3DTileset()

3. モデル配置

       viewer.entities.add({
         model: { uri: ... }
       })

4. HeadingPitchRoll を使用した向き設定

       Cesium.Transforms.headingPitchRollQuaternion(...)

5. 初期カメラ flyTo
6. 読み込み完了ログ

       console.log("読み込み完了: ...")

## 出力ルール

必ず次の順序で出力する。

1. 短い説明（2〜5行）
2. 完全な JavaScript コード
3. 必要なら微調整ポイント（最大 3 項目）

## ファイル出力ルール

生成した JavaScript は必ず次のファイルに書き込む。

    generated/sandcastle.js

ファイルが既に存在する場合は上書きする。

説明の末尾に「Google Maps API キーが必要」「createGooglePhotorealistic3DTileset() にはAPIキーが必要」などの注記は書かない。

## コード品質ルール

出力コードは次を守る。

- Sandcastle にそのまま貼れる形にする
- 変数名は明確にする
- コメントは日本語で書く
- 最後に console.log("読み込み完了: ...") を入れる
- テンプレート構造を大きく変更しない
- 不要な外部ライブラリを追加しない
- モデル URI を未設定にしない
- 擬似コードを出力しない
- コードを途中で省略しない

### 移動モードで必ず定義するもの

- route2D
- PERSON
- startIso

### 移動モードで必ず使うもの

- await Cesium.createGooglePhotorealistic3DTileset()
- viewer.scene.preRender.addEventListener(...)

### 固定配置モードで必ず使うもの

- await Cesium.createGooglePhotorealistic3DTileset()
- Cesium.Cartesian3.fromDegrees(...)
- Cesium.Transforms.headingPitchRollQuaternion(...)
- viewer.entities.add({ model: { uri: ... } })
- viewer.camera.flyTo(...)

## 禁止事項

次は行わない。

- HTML 全体を出力する
- Sandcastle で動かないコードを出力する
- route2D を空にする
- 固定配置モードで route2D を含む移動コードを混在させる
- モデル URI を未設定にする
- GitHub の通常ページ URL をそのまま model.uri に使う
- 擬似コードを出力する
- コードを途中で省略する

## ルート座標の扱い

presets/tokyo_routes.json に近いルートがある場合は、それを参考にしてよい。

ただし、ユーザー指定が明確ならそちらを優先する。

## 入力例

- 虎ノ門ヒルズから東京タワーまで CesiumMan が歩くコード
- 渋谷駅から原宿駅まで myPegasus.glb が少し上から追尾
- お台場海浜公園からフジテレビまで車の glb が移動
- 豊洲ぐるり公園に japanese_house.gltf を置く Sandcastle コード
- 指定座標に general_hospital.gltf を固定配置
- 3D マップ上に apartment.gltf を表示したい

## 出力方針

### 移動モード

- walk_follow または drone_follow を選択する
- route2D を自然に生成する
- PERSON.glb を差し替える
- ラベル名を差し替える
- 必ず完全コードを出力する

### 固定配置モード

- place_model を選択する
- MODEL_URL を設定する
- LAT / LON を設定する
- 必要に応じて高さ・向き・スケールを設定する
- 初期カメラをモデル中心へ向ける
- 基本は真上視点に近いカメラにする
- 必ず完全コードを出力する
