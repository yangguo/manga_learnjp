#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/process-mokuro-colab.sh INPUT.pdf [OUTPUT.zip]

Environment overrides:
  COLAB_GPU=T4              GPU type passed to colab new. Set empty for CPU.
  COLAB_DPI=220             PDF render DPI for pdftoppm.
  COLAB_SESSION_NAME=name   Reuse/set a specific session name.
  COLAB_KEEP_SESSION=1      Do not stop the Colab session after completion.

The output zip contains:
  <volume>.mokuro
  <volume>/page-001.jpg ...
  _ocr/<volume>/*.json
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage >&2
  exit 2
fi

input_pdf="$1"
if [[ ! -f "$input_pdf" ]]; then
  echo "Input PDF not found: $input_pdf" >&2
  exit 1
fi

if ! command -v colab >/dev/null 2>&1; then
  echo "colab CLI not found. Install with: uv tool install google-colab-cli" >&2
  exit 1
fi

base_name="$(basename "$input_pdf")"
volume_name="${base_name%.*}"
volume_name="$(printf '%s' "$volume_name" | sed 's/[^A-Za-z0-9._-]/-/g')"
if [[ -z "$volume_name" ]]; then
  volume_name="volume"
fi

output_zip="${2:-output/pdf/${volume_name}-mokuro-output.zip}"
mkdir -p "$(dirname "$output_zip")"

dpi="${COLAB_DPI:-220}"
gpu="${COLAB_GPU:-T4}"
session_name="${COLAB_SESSION_NAME:-mokuro-${volume_name}}"
keep_session="${COLAB_KEEP_SESSION:-0}"

remote_pdf="/content/${volume_name}.pdf"
remote_work="/content/${volume_name}-mokuro-work"
remote_zip="/content/${volume_name}-mokuro-output.zip"
remote_script="$(mktemp -t mokuro-colab-XXXXXX.py)"

json_quote() {
  python3 -c 'import json, sys; print(json.dumps(sys.argv[1]))' "$1"
}

remote_pdf_json="$(json_quote "$remote_pdf")"
remote_work_json="$(json_quote "$remote_work")"
volume_name_json="$(json_quote "$volume_name")"
remote_zip_base_json="$(json_quote "${remote_zip%.zip}")"
dpi_json="$(json_quote "$dpi")"

cleanup() {
  rm -f "$remote_script"
  if [[ "$keep_session" != "1" ]]; then
    OAUTHLIB_RELAX_TOKEN_SCOPE=1 colab stop -s "$session_name" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

cat > "$remote_script" <<PY
import inspect
import os
import shutil
import subprocess
import sys
from pathlib import Path


PDF_PATH = Path($remote_pdf_json)
WORK_DIR = Path($remote_work_json)
VOLUME_NAME = $volume_name_json
VOLUME_DIR = WORK_DIR / VOLUME_NAME
ZIP_BASE = Path($remote_zip_base_json)
DPI = $dpi_json


def run_command(command, *, shell=False):
    print(f'RUN: {command}', flush=True)
    subprocess.run(command, shell=shell, check=True)


def main():
    if not PDF_PATH.is_file():
        raise FileNotFoundError(f'Missing input PDF: {PDF_PATH}')

    shutil.rmtree(WORK_DIR, ignore_errors=True)
    VOLUME_DIR.mkdir(parents=True, exist_ok=True)

    run_command('apt-get update && apt-get install -y poppler-utils', shell=True)
    run_command([sys.executable, '-m', 'pip', 'install', '-U', 'mokuro'])
    run_command([
        'pdftoppm',
        '-jpeg',
        '-r',
        DPI,
        str(PDF_PATH),
        str(VOLUME_DIR / 'page'),
    ])

    rendered_pages = sorted(VOLUME_DIR.glob('*.jpg'))
    print(f'Rendered pages: {len(rendered_pages)}', flush=True)
    if not rendered_pages:
        raise RuntimeError('PDF rendering produced no JPEG pages')

    from mokuro.run import run as mokuro_run

    kwargs = {'disable_confirmation': True}
    signature = inspect.signature(mokuro_run)
    if 'legacy_html' in signature.parameters:
        kwargs['legacy_html'] = False
    elif 'disable_html' in signature.parameters:
        kwargs['disable_html'] = True

    print(f'Running mokuro with kwargs: {kwargs}', flush=True)
    mokuro_run(str(VOLUME_DIR), **kwargs)

    mokuro_file = WORK_DIR / f'{VOLUME_NAME}.mokuro'
    if not mokuro_file.is_file():
        raise RuntimeError(f'Mokuro output not found: {mokuro_file}')

    archive_path = shutil.make_archive(str(ZIP_BASE), 'zip', WORK_DIR)
    print(f'Created archive: {archive_path}', flush=True)
    print(f'Archive size bytes: {os.path.getsize(archive_path)}', flush=True)


if __name__ == '__main__':
    main()
PY

colab_cmd=(colab)

echo "Creating Colab session: $session_name"
if [[ -n "$gpu" ]]; then
  OAUTHLIB_RELAX_TOKEN_SCOPE=1 "${colab_cmd[@]}" new -s "$session_name" --gpu "$gpu"
else
  OAUTHLIB_RELAX_TOKEN_SCOPE=1 "${colab_cmd[@]}" new -s "$session_name"
fi

echo "Uploading PDF to $remote_pdf"
OAUTHLIB_RELAX_TOKEN_SCOPE=1 "${colab_cmd[@]}" upload -s "$session_name" "$input_pdf" "$remote_pdf"

echo "Running remote mokuro job"
set +e
OAUTHLIB_RELAX_TOKEN_SCOPE=1 "${colab_cmd[@]}" exec -s "$session_name" -f "$remote_script"
exec_status=$?
set -e
if [[ "$exec_status" -ne 0 ]]; then
  echo "colab exec returned non-zero; checking whether remote zip was created" >&2
fi

if ! OAUTHLIB_RELAX_TOKEN_SCOPE=1 "${colab_cmd[@]}" ls -s "$session_name" "$remote_zip" >/dev/null; then
  echo "Remote mokuro zip was not found: $remote_zip" >&2
  exit "$exec_status"
fi

echo "Downloading $remote_zip to $output_zip"
OAUTHLIB_RELAX_TOKEN_SCOPE=1 "${colab_cmd[@]}" download -s "$session_name" "$remote_zip" "$output_zip"

echo "Verifying zip archive"
zip -T "$output_zip"

echo "Wrote $output_zip"
