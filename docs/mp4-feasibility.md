# ブラウザ内MP4書き出し：技術判断と検証

## 判断

対応するiPhone Safariでは、外部サーバーや有料サービスを使わず、WebCodecsでH.264をエンコードし、MP4コンテナに格納する方式が実装可能と判断した。ただしAPIの対応確認だけで実機動作を保証しない。本PRは「対応を検出した端末で利用する実験的機能」とし、iPhone実機での検証を残す。

Safari 16.4では動画用WebCodecsが導入された。OSのバージョンだけで決めず、HTTPS、VideoEncoder、VideoFrameの存在とMediabunnyのcanEncodeVideoで画質ごとにH.264の対応を調べる。非対応では書き出しを無効にし、既存の編集・プレビューを継続する。

## 方式比較

| 方式 | 判断 |
| --- | --- |
| WebCodecs + MP4 muxer | 採用。フレームの時刻と長さを明示でき、実時間の画面録画に依存しない。MediabunnyのCanvasSourceとMP4出力を使用する。 |
| Canvas.captureStream + MediaRecorder | SafariにMP4/H.264の公式対応例がある。ただし実時間録画のため、処理遅延やバックグラウンド移行が切り替え時間・フレーム数に影響する。今回の自動フォールバックには使用しない。 |
| ffmpeg.wasm | CPU・メモリ・配布サイズの負荷が大きく、GitHub Pagesで任意のHTTPヘッダーを設定できない点も考慮し、今回採用しない。 |
| サーバーレンダリング | 写真を外部送信しない要件に合わないため採用しない。 |

## 実装

- 高画質1080×1920（目標6Mbps）、軽量720×1280（目標3Mbps）、30fps、H.264、無音MP4。
- 写真の累積表示時間からフレーム境界を計算し、同じ写真を必要フレーム数だけ入力する。現UIの小数1桁の秒数は30fpsのフレーム単位で表現できる。
- 各CanvasSource.addをawaitし、エンコードキューを無制限に積まない。画像を1枚ずつ追加デコードし、使用後に参照を解放する。フレームごとの新規Canvasを作らない。
- 30枚・60秒上限、1回の非同期処理30秒上限、中止、非表示時中止、編集ロック、古い出力URLの解放。
- 完成データはBufferTargetとBlobで保持する。完成までと共有時に複数のバッファが存在しうる。元画像を多数選択するとプレビュー自体もメモリを使うため、OSによる終了を完全には防げない。
- Safariで能力チェックが成功してもエンコーダーが動かない事例がある。タイムアウトと軽量設定を案内する。共有はWeb Shareのファイル対応を別途検出し、ダウンロードを常に代替として提供する。

## 検証済み・未検証

- Linux Chromiumで実際にMP4を生成・ダウンロードした。
- ffprobeで1080×1920、720×1280の双方がH.264・30fps・45フレーム・1.5秒であることを確認した。
- 2枚を並べ替え、青0.5秒→赤1秒とした動画をffmpegで復号し、フレーム0/14が青、15/44が赤であることを確認した。
- モバイル幅390px・タッチ有効で操作し、JSエラーなし、写真の外部リクエストなしを確認した。中止後に部分ファイルを提示せず、編集が再開できることも確認した。
- 自動テストでは元の編集・再生、フレーム割り当て、非対応・失敗・中止処理、出力URL破棄を確認する。自動テストのエンコーダーはモックであり、実エンコード検証とは区別する。
- iPhone実機Safari、HEIC/EXIF写真の出力、iOS共有メニューと写真アプリへの保存、Instagramへの実際の取り込みは未検証。Playwright WebKitはこの環境にインストールされておらず、Safariでの成功を主張しない。

## マージ前に推奨するiPhone確認

HTTPSでPRのビルドを配信できる検証環境、またはローカルHTTPSで実施する（現行GitHub Pagesのmain公開版には本PRはまだ反映されない）。

1. JPEG/HEICを複数選び、順番と1.5秒・0.5秒・2秒を設定。プレビューと出力の向き・切り抜き・順番を比較する。
2. 両画質で完了し、共有から「ビデオを保存」。写真アプリとInstagramで再生する。
3. 書き出し中の画面ロック・別タブ移動・中止後に再試行する。
4. 非対応端末では書き出し不可の案内と編集継続を確認する。
5. 実写写真で枚数・長さを増やし、発熱・時間・メモリを確認する。60秒上限はすべての端末での成功保証ではない。

非対応・失敗時の代替は、軽量設定、少ない写真、最新Safariへの更新、それでも不可なら写真アプリ/iMovie等の端末内動画編集アプリで作成する。写真のアップロードやMP4への拡張子偽装は行わない。

## 一次情報

- [WebKit: Safari 16.4のWebCodecs導入](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/)
- [WebKit: MediaRecorderとMP4/H.264](https://webkit.org/blog/11353/mediarecorder-api/)
- [WebKit Bug 258669: FullHDで能力チェック成功後にエンコーダーが出力しない事例](https://bugs.webkit.org/show_bug.cgi?id=258669)
- [Mediabunny: メディアファイルの生成](https://mediabunny.dev/guide/writing-media-files)
- [Mediabunny: CanvasSource](https://mediabunny.dev/api/CanvasSource)
- [Mediabunnyのソースとライセンス](https://github.com/Vanilagy/mediabunny)
