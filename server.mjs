import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import { createServer as createViteServer } from 'vite'

const PORT = Number(process.env.PORT || 5173)
const DEVICE_PORT = 8266
const HEX = /^[0-9a-f]*$/i

function json(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(value))
}

async function body(req) {
  let text = ''
  for await (const chunk of req) text += chunk
  return text ? JSON.parse(text) : {}
}

function privateIpv4(value) {
  const parts = String(value).split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
  return parts[0] === 10 || parts[0] === 127 || (parts[0] === 192 && parts[1] === 168) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
}

function localSubnet() {
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal && privateIpv4(entry.address)) {
        return entry.address.split('.').slice(0, 3).join('.')
      }
    }
  }
  return null
}

// 与 ThaloPliot 的 scanReachableDevices 完全一致：24 并发，TCP 8266，120ms 连接超时。
// 设备读取由用户点击列表项后单独执行，不参与局域网发现。
function probe(host, timeout = 120) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port: DEVICE_PORT })
    let settled = false
    const done = (open) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(open)
    }
    socket.setTimeout(timeout, () => done(false))
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
  })
}

async function mapConcurrent(items, limit, worker) {
  const output = []
  const queue = [...items]
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (queue.length) output.push(await worker(queue.shift()))
  }))
  return output
}

async function scan(subnet) {
  if (!/^((10|127)|192\.168|(172\.(1[6-9]|2\d|3[0-1])))\.\d{1,3}$/.test(subnet)) throw new Error('仅允许扫描本机私有 IPv4 /24 网段')
  const candidates = Array.from({ length: 254 }, (_, index) => `${subnet}.${index + 1}`)
  const reachable = await mapConcurrent(candidates, 24, async (host) => ((await probe(host)) ? host : null))
  return reachable
    .filter(Boolean)
    .sort((left, right) => left.split('.').reduce((value, part) => value * 256 + Number(part), 0) - right.split('.').reduce((value, part) => value * 256 + Number(part), 0))
}

function exchange(host, hex, timeout = 1400) {
  if (!privateIpv4(host)) return Promise.reject(new Error('目标必须为私有 IPv4 地址'))
  if (!HEX.test(hex) || hex.length % 2 || !hex) return Promise.reject(new Error('报文必须是偶数长度的 HEX 字符串'))
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port: DEVICE_PORT })
    const chunks = []
    let settled = false
    const finish = (error) => {
      if (settled) return
      settled = true
      socket.destroy()
      if (error) reject(error)
      else resolve(Buffer.concat(chunks).toString('hex').toUpperCase())
    }
    socket.setTimeout(timeout, () => finish())
    socket.once('error', finish)
    socket.once('connect', () => socket.write(Buffer.from(hex, 'hex')))
    socket.on('data', (chunk) => chunks.push(chunk))
  })
}

const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' })
const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/api/health') return json(res, 200, { ok: true, port: DEVICE_PORT, subnet: localSubnet() })
    if (req.url === '/api/scan' && req.method === 'POST') {
      const { subnet = localSubnet() } = await body(req)
      if (!subnet) throw new Error('未找到私有 IPv4 网卡，请手动输入网段')
      return json(res, 200, { subnet, devices: (await scan(subnet)).map((host) => ({ host, name: null })) })
    }
    if (req.url === '/api/send' && req.method === 'POST') {
      const { host, command, timeout } = await body(req)
      const response = await exchange(host, String(command || ''), Number(timeout) || 1400)
      return json(res, 200, { host, command: String(command).toUpperCase(), response })
    }
    vite.middlewares(req, res, () => json(res, 404, { error: 'Not found' }))
  } catch (error) {
    json(res, 400, { error: error.message || '请求失败' })
  }
})

server.listen(PORT, () => console.log(`ThaloConsole is ready at http://localhost:${PORT}`))
