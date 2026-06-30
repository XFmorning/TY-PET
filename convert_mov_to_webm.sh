#!/bin/bash
set -euo pipefail

usage() {
  cat <<'EOF'
用法:
  ./scripts/convert_mov_to_webm.sh <input.mov>
  ./scripts/convert_mov_to_webm.sh <input.mov> <output.webm>
  ./scripts/convert_mov_to_webm.sh <input_dir> [output_dir]

说明:
  - 输入单个 .mov 时，默认输出到同目录同名 .webm
  - 输入目录时，会批量转换目录下所有 .mov/.MOV
  - 该脚本依赖 ffmpeg

示例:
  ./scripts/convert_mov_to_webm.sh ~/Desktop/cat-idle.mov
  ./scripts/convert_mov_to_webm.sh ~/Desktop/cat-idle.mov ./assets/cat-idle.webm
  ./scripts/convert_mov_to_webm.sh ~/Desktop/cat-movs ./converted-webm
EOF
}

require_ffmpeg() {
  if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "未检测到 ffmpeg。"
    echo "请先安装：brew install ffmpeg"
    exit 1
  fi
}

convert_one() {
  local input="$1"
  local output="$2"

  mkdir -p "$(dirname "$output")"

  echo "转换中:"
  echo "  输入: $input"
  echo "  输出: $output"

  ffmpeg -y \
    -i "$input" \
    -an \
    -c:v libvpx-vp9 \
    -pix_fmt yuva420p \
    -b:v 0 \
    -crf 30 \
    -deadline good \
    -row-mt 1 \
    -auto-alt-ref 0 \
    "$output"

  echo "完成: $output"
  echo ""
}

convert_dir() {
  local input_dir="$1"
  local output_dir="$2"
  local found=0

  mkdir -p "$output_dir"
  shopt -s nullglob nocaseglob

  for file in "$input_dir"/*.mov; do
    found=1
    local base
    base="$(basename "$file")"
    local name="${base%.*}"
    convert_one "$file" "$output_dir/$name.webm"
  done

  shopt -u nullglob nocaseglob

  if [[ "$found" -eq 0 ]]; then
    echo "目录里没有找到 .mov 文件: $input_dir"
    exit 1
  fi
}

main() {
  if [[ $# -lt 1 || $# -gt 2 ]]; then
    usage
    exit 1
  fi

  require_ffmpeg

  local input="$1"
  local output="${2:-}"

  if [[ ! -e "$input" ]]; then
    echo "输入不存在: $input"
    exit 1
  fi

  if [[ -d "$input" ]]; then
    local output_dir="${output:-$input/converted-webm}"
    convert_dir "$input" "$output_dir"
    exit 0
  fi

  local ext="${input##*.}"
  local lower_ext="${ext,,}"
  if [[ "$lower_ext" != "mov" ]]; then
    echo "当前脚本只处理 .mov 文件: $input"
    exit 1
  fi

  if [[ -z "$output" ]]; then
    output="${input%.*}.webm"
  fi

  convert_one "$input" "$output"
}

main "$@"