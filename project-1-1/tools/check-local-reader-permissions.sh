#!/usr/bin/env bash
# Read-only Frappe permission audit for the disposable local Step-2 instance.
set -euo pipefail
container=project11-erp-backend-1
site=frontend
user=erp-reader@example.com
bench=(docker exec -w /home/frappe/frappe-bench "$container" bench --site "$site" execute)
roles=$("${bench[@]}" frappe.get_roles --args "[\"$user\"]")
printf 'reader roles: %s\n' "$roles"
[[ "$roles" == *'ERP Agent Reader'* ]] || { echo 'reader role missing' >&2; exit 1; }
[[ "$roles" != *'System Manager'* ]] || { echo 'unexpected System Manager role' >&2; exit 1; }
for doctype in 'Item' 'Sales Order' 'Sales Invoice'; do
  for ptype in read write create delete submit cancel; do
    kwargs=$(printf '{"doctype":"%s","ptype":"%s","user":"%s"}' "$doctype" "$ptype" "$user")
    result=$("${bench[@]}" frappe.has_permission --kwargs "$kwargs")
    [[ "$result" == true ]] && permitted=true || permitted=false
    printf '%s %s: %s\n' "$doctype" "$ptype" "$permitted"
    if [[ "$ptype" == read ]]; then
      [[ "$permitted" == true ]] || exit 1
    else
      [[ "$permitted" == false ]] || exit 1
    fi
  done
done
