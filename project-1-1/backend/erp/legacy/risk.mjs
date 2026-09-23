const MAP = {
    'erp.query': 'read',
    'erp.get': 'read',
    'erp.run_report': 'read',
    'erp.create_draft': 'external', // 写进宿主 = 副作用出了本机 → external,不是 write_local
    'erp.submit': 'external',
};
export function classify(action) {
    return MAP[action];
}
