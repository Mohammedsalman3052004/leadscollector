export const str = (fd: FormData, key: string, max = 500) => String(fd.get(key) ?? '').trim().slice(0, max);
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254;
export const isHostname = (v: string) => /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(v) || v === 'localhost';
export const splitList = (v: string) => v.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
