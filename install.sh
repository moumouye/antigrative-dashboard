#!/bin/sh
set -eu
task_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ -f "$task_root/manage.py" ]; then
    exec python3 "$task_root/manage.py" install "$@"
else
    exec curl -fsSL https://raw.githubusercontent.com/moumouye/antigrative-dashboard/main/install.py | python3 - "$@"
fi
