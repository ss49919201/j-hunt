# j-hunt

転職活動の企業、選考イベント、ノート、職務経歴書をローカルのSQLiteだけで管理するCLIです。

## 必要環境

- [Bun](https://bun.sh/) 1.1以降

## セットアップ

```bash
bun install
bun link
j-hunt --help
```

`bun link`を使わない場合は、`bun run src/cli.ts`でも実行できます。

## クイックスタート

```bash
# 企業を登録
j-hunt company add "Example株式会社" --website https://example.com

# 選考上の事実を記録
j-hunt event add "Example株式会社" casual-interview-applied
j-hunt event add "Example株式会社" casual-interview-scheduled
j-hunt event add "Example株式会社" casual-interview-completed

# PDFをDBへ保存し、企業への提出を記録
j-hunt resume add ./resume.pdf --name "職務経歴書 v3"
j-hunt resume submit "職務経歴書 v3" "Example株式会社"

# 現在状態と履歴を確認
j-hunt company list
j-hunt company show "Example株式会社"
```

現在状態は企業レコードへ保存せず、時系列のイベントから毎回導出します。`resume submit`は、提出履歴と`resume_submitted`イベントを同一トランザクションで記録します。

## コマンド

```text
j-hunt company add <name> [--website <url>]
j-hunt company list
j-hunt company show <id|name>
j-hunt company update <id|name> [--name <name>] [--website <url>]
j-hunt company delete <id|name> [--force]

j-hunt event add <company> <type> [--at <ISO8601>] [type options]
j-hunt event list <company>

j-hunt note add <company> --title <title> --body <body>
j-hunt note list <company>
j-hunt note update <id> [--title <title>] [--body <body>]
j-hunt note delete <id>

j-hunt resume add <pdf-path> [--name <name>]
j-hunt resume list
j-hunt resume export <id|name> <output-path> [--force]
j-hunt resume submit <id|name> <company> [--at <ISO8601>]
j-hunt resume delete <id|name> [--force]
```

イベント種別:

- `casual-interview-applied`
- `casual-interview-scheduled`
- `casual-interview-completed`
- `selection-scheduled --round <n>`
- `selection-completed --round <n>`
- `offer-received [--position <text>] [--salary <number>]`
- `rejected [--reason <text>]`

`resume-submitted`は`resume submit`によってのみ記録します。

全コマンドで`--json`を指定するとJSON形式で出力できます。DBの場所は`--db <path>`または`J_HUNT_DB_PATH`で変更できます。

## データ保存先

既定では次の1ファイルに全データを保存します。

```text
${XDG_DATA_HOME:-~/.local/share}/j-hunt/career.db
```

PDF本体もSQLiteのBLOBとして保存されます。このDBファイルをコピーすれば、アプリの全データをバックアップできます。安全なバックアップにはCLIの利用を止めた状態でのコピー、またはSQLiteのバックアップコマンドを利用してください。

## 開発

```bash
bun run format:check
bun test
bun run typecheck
bun run build
```

コードを整形するには `bun run format` を実行してください。
