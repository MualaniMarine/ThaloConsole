import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { isIPv4 } from 'node:net'
import { join } from 'node:path'
import { promisify } from 'node:util'

const executeFile = promisify(execFile)
const commandOptions = { encoding: 'utf8', windowsHide: true, timeout: 2500, maxBuffer: 1024 * 1024 }

export function normalizeMac(value) {
  const compact = String(value || '').trim().replace(/[:-]/g, '').toUpperCase()
  if (!/^[0-9A-F]{12}$/.test(compact) || /^0{12}$/.test(compact) || /^F{12}$/.test(compact)) return ''
  // ARP 中的广播、组播地址不能用作灯具身份。
  if (Number.parseInt(compact.slice(0, 2), 16) & 1) return ''
  return compact.match(/.{2}/g).join(':')
}

export function parseArpTable(output) {
  const entries = []
  for (const line of String(output).split(/\r?\n/)) {
    // Windows 格式从 IP 开始；macOS 使用 “name (IP) at MAC”。
    const match = line.match(/^\s*(\d{1,3}(?:\.\d{1,3}){3})\s+([\da-f]{2}(?:[:-][\da-f]{2}){5})(?:\s|$)/i)
      || line.match(/\((\d{1,3}(?:\.\d{1,3}){3})\)\s+at\s+([\da-f]{1,2}(?::[\da-f]{1,2}){5})(?:\s|$)/i)
    if (!match || !isIPv4(match[1])) continue
    const mac = normalizeMac(match[2].split(':').map((part) => part.padStart(2, '0')).join(':'))
    if (mac) entries.push({ host: match[1], mac })
  }
  return entries
}

export function parseIpNeighbors(output) {
  const entries = JSON.parse(output)
  if (!Array.isArray(entries)) throw new Error('邻居表格式无效')
  return entries.flatMap((entry) => {
    const states = Array.isArray(entry.state) ? entry.state : [entry.state]
    const mac = normalizeMac(entry.lladdr)
    return isIPv4(entry.dst || '') && mac && !states.some((state) => /^(FAILED|INCOMPLETE|UNREACHABLE)$/i.test(state || ''))
      ? [{ host: entry.dst, mac }] : []
  })
}

export function parseProcArp(output) {
  return String(output).split(/\r?\n/).flatMap((line) => {
    const parts = line.trim().split(/\s+/)
    const mac = normalizeMac(parts[3])
    return isIPv4(parts[0] || '') && mac && (Number.parseInt(parts[2], 16) & 2)
      ? [{ host: parts[0], mac }] : []
  })
}

export async function readNeighborTable({ platform = process.platform, run = executeFile, read = readFile } = {}) {
  try {
    if (platform === 'win32') {
      const executable = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'arp.exe')
      const { stdout } = await run(executable, ['-a'], commandOptions)
      return { entries: parseArpTable(stdout), source: 'arp', error: '' }
    }
    if (platform === 'linux') {
      try {
        const { stdout } = await run('ip', ['-j', '-4', 'neigh', 'show'], commandOptions)
        return { entries: parseIpNeighbors(stdout), source: 'neighbor', error: '' }
      } catch {
        return { entries: parseProcArp(await read('/proc/net/arp', 'utf8')), source: 'arp', error: '' }
      }
    }
    if (platform === 'darwin') {
      const { stdout } = await run('/usr/sbin/arp', ['-an'], commandOptions)
      return { entries: parseArpTable(stdout), source: 'arp', error: '' }
    }
    return { entries: [], source: '', error: '当前系统暂不支持读取 MAC' }
  } catch (error) {
    return { entries: [], source: '', error: `读取系统邻居表失败（${error.code || error.name}）` }
  }
}

export function macInfoForHost(table, host) {
  const matches = [...new Set(table.entries.filter((entry) => entry.host === host).map((entry) => entry.mac))]
  if (matches.length === 1) {
    if (table.entries.some((entry) => entry.host !== host && entry.mac === matches[0])) {
      return { mac: '', macSource: '', macError: '系统邻居表中该 MAC 对应多个 IP，无法确认唯一设备身份' }
    }
    return { mac: matches[0], macSource: table.source, macError: '' }
  }
  return {
    mac: '', macSource: '',
    macError: table.error || (matches.length > 1 ? '多个网卡对该 IP 返回不同 MAC，无法确认设备身份' : '系统邻居表中没有该 IP 的 MAC；请确认设备与本机处于同一局域网'),
  }
}

// 同时刷新多台灯具时共用一次系统查询；不长期缓存 IP 与 MAC 的对应关系。
let pendingNeighbors = null
export function currentNeighborTable() {
  if (!pendingNeighbors) pendingNeighbors = readNeighborTable().finally(() => { pendingNeighbors = null })
  return pendingNeighbors
}
