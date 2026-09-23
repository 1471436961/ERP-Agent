import { PermissionError } from './types.mjs';
/**
 * 层2:身份与授权。真正的授权判断交给 ERPNext(HttpErpClient 已带某用户 session)。
 * 这里只做纵深防御的 allowlist —— 不在名单的 DocType 一律拒,不指望宿主永远配对。
 */
export class Identity {
    allow;
    constructor(allow) {
        this.allow = allow;
    }
    enforce(call) {
        // erp.run_report 不带 docType —— 这层 allowlist 是按 DocType 做纵深防御,对它没有抓手可挂。
        // 这不是"单独在别处管":tools.ts 的 report: z.string() 没有任何白名单,risk.ts 把
        // run_report 归类为 read 使 Limits 也直接跳过。这个动作的授权完全落回宿主自己的报表权限
        // (谁能跑哪张 Report,由 ERPNext 的角色/Report 权限决定)—— 是一处刻意保留、写明原因的
        // 例外,不是疏漏。
        if (!call.docType)
            return;
        if (!this.allow.includes(call.docType)) {
            throw new PermissionError(`DocType ${call.docType} not in allowlist`);
        }
    }
}
