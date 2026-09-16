import './device-status.css'

const DEVICE_NAME_STORAGE_KEY = 'thalo-console-device-names-v1'
const DEVICE_GROUP_STORAGE_KEY = 'thalo-console-device-groups-by-name-v2'
const DEVICE_STATUS_HOSTS_STORAGE_KEY = 'thalo-console-status-hosts-v1'
const DEVICE_RUNTIME_STORAGE_KEY = 'thalo-console-device-runtime-v1'
const READ_COMMAND = 'AAA51008BB'
const CHANNEL_COLORS = ['#cbd5e1', '#60a5fa', '#4ade80', '#a78bfa', '#22d3ee', '#f87171']
const CARD_MIN_WIDTH = 300
const CARD_HEIGHT = 300
const GRID_GAP = 15

const app = document.getElementById('deviceStatusApp')
app.innerHTML = `
  <div class="status-page">
    <header class="status-page-head">
      <div>
        <h1>多设备状态</h1>
        <p id="statusSummary">正在载入设备…</p>
      </div>
      <div class="status-page-actions">
        <button id="btnStatusRefresh" type="button">立即刷新</button>
        <a href="./index.html">返回控制台</a>
      </div>
    </header>
    <main class="status-page-main" id="statusMain">
      <div class="status-device-grid" id="statusGrid"></div>
    </main>
    <footer class="status-pagination" id="statusPagination"></footer>
  </div>`

const summary = document.getElementById('statusSummary')
const main = document.getElementById('statusMain')
const grid = document.getElementById('statusGrid')
const pagination = document.getElementById('statusPagination')
const refreshButton = document.getElementById('btnStatusRefresh')

let devices = []
let page = 0
let pageSize = 1
let columns = 1
let rows = 1
let refreshRunning = false
let renderFrame = 0
let autoRefreshTimer = null
const states = new Map()
const failureCounts = new Map()

const cleanText = (value) => String(value || '').replace(/\s+/g, '').trim()
const readObjectStorage = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch { return {} }
}
const deviceNames = () => readObjectStorage(DEVICE_NAME_STORAGE_KEY)
const deviceGroups = () => readObjectStorage(DEVICE_GROUP_STORAGE_KEY)
const runtimeStates = () => readObjectStorage(DEVICE_RUNTIME_STORAGE_KEY)

function normalizeHexStream(value) {
  const clean = cleanText(value).toLowerCase()
  if (!/^[0-9a-f]+$/.test(clean)) throw new Error('回包包含非 HEX 字符')
  return clean
}
function parsePacketBody(clean) {
  if (!clean.startsWith('abaa')) throw new Error('缺少 ABAA 起始标记')
  if (clean.length < 22) throw new Error('设备报文长度不足')
  const manualHeader = clean.slice(8, 20)
  if (!/^[0-9a-f]{12}$/.test(manualHeader)) throw new Error('手动亮度数据无效')
  const groupCount = Number.parseInt(clean.slice(20, 22), 16)
  if (!Number.isFinite(groupCount) || groupCount <= 0) throw new Error('设备报文分组数无效')
  const payloadEnd = 22 + groupCount * 16
  if (clean.length < payloadEnd + 2) throw new Error('设备时序数据不完整')
  return { clean, manualHeader, groupCount, payload: clean.slice(22, payloadEnd) }
}
function resolvePacket(value) {
  const clean = normalizeHexStream(value)
  try { return parsePacketBody(clean) } catch (firstError) {
    if (!clean.startsWith('abaaa5a1')) throw firstError
  }
  let start = clean.indexOf('abaa', 8)
  while (start >= 0) {
    try { return parsePacketBody(clean.slice(start)) } catch { start = clean.indexOf('abaa', start + 4) }
  }
  throw new Error('未找到完整配置报文')
}
function parseGroups(payload) {
  if (payload.length % 16) throw new Error('时序分组长度无效')
  const result = []
  for (let offset = 0; offset < payload.length; offset += 16) {
    const group = []
    for (let byte = 0; byte < 16; byte += 2) group.push(Number.parseInt(payload.slice(offset + byte, offset + byte + 2), 16))
    result.push(group)
  }
  return result
}
function packetDeviceName(packet) {
  if (packet.clean.length < 430) return ''
  const bytes = packet.clean.slice(408, 430).match(/.{2}/g).map((part) => Number.parseInt(part, 16))
  return new TextDecoder().decode(new Uint8Array(bytes)).replace(/[\0\s]/g, '')
}
function packetMode(packet) {
  const offset = 22 + packet.groupCount * 16
  const flag = packet.clean.slice(offset, offset + 2)
  if (flag === '01') return 'automatic'
  if (flag === '00') return 'manual'
  return 'unknown'
}
function curveValues(groups, minute) {
  if (!groups.length) return []
  const points = groups.map((group) => ({ minute: group[0] * 60 + group[1], values: group.slice(2, 8) }))
  const target = ((minute % 1440) + 1440) % 1440
  const nextIndex = points.findIndex((point) => point.minute >= target)
  let previous
  let next
  if (nextIndex === 0) {
    previous = { ...points.at(-1), minute: points.at(-1).minute - 1440 }
    next = points[0]
  } else if (nextIndex < 0) {
    previous = points.at(-1)
    next = { ...points[0], minute: points[0].minute + 1440 }
  } else {
    previous = points[nextIndex - 1]
    next = points[nextIndex]
  }
  const ratio = Math.max(0, Math.min(1, (target - previous.minute) / Math.max(1, next.minute - previous.minute)))
  return previous.values.map((value, index) => value + (next.values[index] - value) * ratio)
}
function parseDeviceResponse(host, response) {
  const packet = resolvePacket(response)
  const groups = parseGroups(packet.payload)
  const cachedRuntime = runtimeStates()[host] || {}
  const elapsed = Date.now() - Number(cachedRuntime.demoStartedAt || Date.now())
  const demoActive = cachedRuntime.mode === 'demo' && elapsed < 240000
  const mode = demoActive ? 'demo' : packetMode(packet)
  const now = new Date()
  const minute = demoActive
    ? Math.min(1439.999, (elapsed / 240000) * 1440)
    : now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
  const values = mode === 'manual'
    ? Array.from({ length: 6 }, (_, index) => Number.parseInt(packet.manualHeader.slice(index * 2, index * 2 + 2), 16))
    : curveValues(groups, minute)
  const brightness = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
  return { name: packetDeviceName(packet), groups, mode, brightness }
}
const modeLabel = (mode) => ({ automatic: '自动模式', manual: '手动模式', demo: '演示模式', unknown: '未获取' }[mode] || '未获取')
const timestamp = () => new Date().toLocaleTimeString('zh-CN', { hour12: false })

function loadDevices() {
  const names = deviceNames()
  const groups = deviceGroups()
  let stored = []
  try {
    const parsed = JSON.parse(localStorage.getItem(DEVICE_STATUS_HOSTS_STORAGE_KEY) || '[]')
    if (Array.isArray(parsed)) stored = parsed
  } catch { /* 使用名称缓存兜底 */ }
  const byHost = new Map()
  stored.forEach((item) => {
    const host = cleanText(typeof item === 'string' ? item : item?.host)
    const name = cleanText(typeof item === 'object' ? item?.name : '') || cleanText(names[host])
    if (host && name) byHost.set(host, { host, name, group: groups[name] || '' })
  })
  Object.entries(names).forEach(([host, name]) => {
    if (cleanText(host) && cleanText(name) && !byHost.has(host)) byHost.set(host, { host, name, group: groups[name] || '' })
  })
  devices = [...byHost.values()].sort((left, right) => (
    left.group.localeCompare(right.group, 'zh-CN') || left.name.localeCompare(right.name, 'zh-CN') || left.host.localeCompare(right.host)
  ))
  devices.forEach((device) => {
    const previous = states.get(device.host) || {}
    states.set(device.host, { status: 'waiting', ...previous, ...device })
  })
  page = Math.min(page, Math.max(0, Math.ceil(devices.length / pageSize) - 1))
}

function calculateCapacity() {
  const firstIndex = page * pageSize
  const availableWidth = Math.max(1, grid.clientWidth)
  const availableHeight = Math.max(1, grid.clientHeight)
  const gap = window.innerWidth <= 680 ? 10 : GRID_GAP
  const minWidth = window.innerWidth <= 680 ? 260 : CARD_MIN_WIDTH
  const cardHeight = window.innerWidth <= 680 ? 280 : CARD_HEIGHT
  columns = Math.max(1, Math.floor((availableWidth + gap) / (minWidth + gap)))
  rows = Math.max(1, Math.floor((availableHeight + gap) / (cardHeight + gap)))
  pageSize = Math.max(1, columns * rows)
  page = Math.floor(firstIndex / pageSize)
  grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`
  grid.style.setProperty('--status-card-height', `${cardHeight}px`)
}

function drawCurve(canvas, groups) {
  if (!groups?.length || !canvas.isConnected) return
  const width = Math.max(180, canvas.clientWidth)
  const height = Math.max(70, canvas.clientHeight)
  const dpr = Math.max(1, window.devicePixelRatio || 1)
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  const context = canvas.getContext('2d')
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.clearRect(0, 0, width, height)
  context.strokeStyle = '#e8eef6'
  context.lineWidth = 1
  ;[0, 0.5, 1].forEach((ratio) => {
    const y = 7 + ratio * (height - 14)
    context.beginPath()
    context.moveTo(7, y)
    context.lineTo(width - 7, y)
    context.stroke()
  })
  CHANNEL_COLORS.forEach((color, channelIndex) => {
    context.beginPath()
    groups.forEach((group, index) => {
      const x = 7 + ((group[0] * 60 + group[1]) / 1439) * (width - 14)
      const y = height - 7 - (group[channelIndex + 2] / 100) * (height - 14)
      if (index) context.lineTo(x, y)
      else context.moveTo(x, y)
    })
    context.strokeStyle = color
    context.lineWidth = 1.5
    context.stroke()
  })
}

function buildCard(device) {
  const state = states.get(device.host) || device
  const card = document.createElement('article')
  card.className = 'status-device-card'
  card.dataset.status = state.status || 'waiting'
  const head = document.createElement('div')
  head.className = 'status-device-head'
  const identity = document.createElement('div')
  identity.className = 'status-device-identity'
  const name = document.createElement('strong')
  name.textContent = state.name || device.name
  const host = document.createElement('span')
  host.textContent = device.host
  identity.append(name, host)
  const badge = document.createElement('span')
  badge.className = 'status-badge'
  badge.textContent = ({ connected: '已连接', connecting: '连接中', warning: '回包异常', failed: '连接失败' })[state.status] || '等待刷新'
  head.append(identity, badge)
  const info = document.createElement('div')
  info.className = 'status-info'
  ;[
    ['设备分组', state.group || '未分组'],
    ['运行模式', modeLabel(state.mode)],
    ['当前总亮度', Number.isFinite(state.brightness) ? `${Math.round(state.brightness * 10) / 10}%` : '—'],
    ['更新时间', state.updatedAt || '—'],
  ].forEach(([label, value]) => {
    const item = document.createElement('div')
    const labelNode = document.createElement('span')
    labelNode.textContent = label
    const valueNode = document.createElement('strong')
    valueNode.textContent = value
    item.append(labelNode, valueNode)
    info.append(item)
  })
  const chartTitle = document.createElement('div')
  chartTitle.className = 'status-chart-title'
  chartTitle.textContent = '六通道 24 小时照明曲线'
  const canvas = document.createElement('canvas')
  canvas.className = 'status-curve'
  const message = document.createElement('div')
  message.className = 'status-card-message'
  message.title = state.error || ''
  message.textContent = state.error || '状态正常'
  card.append(head, info, chartTitle, canvas, message)
  requestAnimationFrame(() => drawCurve(canvas, state.groups))
  return card
}

function renderPagination() {
  const pageCount = Math.max(1, Math.ceil(devices.length / pageSize))
  page = Math.min(page, pageCount - 1)
  const previous = document.createElement('button')
  previous.type = 'button'
  previous.textContent = '上一页'
  previous.disabled = page === 0
  previous.onclick = () => { page -= 1; render() }
  const info = document.createElement('span')
  info.innerHTML = `<strong>${page + 1} / ${pageCount}</strong> 页 · 本页最多 ${pageSize} 台 · 共 ${devices.length} 台`
  const next = document.createElement('button')
  next.type = 'button'
  next.textContent = '下一页'
  next.disabled = page >= pageCount - 1
  next.onclick = () => { page += 1; render() }
  pagination.replaceChildren(previous, info, next)
}

function render() {
  cancelAnimationFrame(renderFrame)
  renderFrame = requestAnimationFrame(() => {
    calculateCapacity()
    const pageDevices = devices.slice(page * pageSize, (page + 1) * pageSize)
    if (!pageDevices.length) {
      const empty = document.createElement('div')
      empty.className = 'status-empty'
      empty.textContent = '暂无设备。请返回控制台扫描灯具并读取设备名称。'
      grid.replaceChildren(empty)
    } else {
      grid.replaceChildren(...pageDevices.map(buildCard))
    }
    renderPagination()
    const stateList = devices.map((device) => states.get(device.host) || {})
    const connected = stateList.filter((state) => state.status === 'connected' || state.status === 'warning').length
    const connecting = stateList.filter((state) => state.status === 'connecting').length
    summary.textContent = devices.length
      ? `监控 ${devices.length} 台 · 已连接 ${connected} 台${connecting ? ` · 正在刷新 ${connecting} 台` : ''} · 每分钟自动刷新`
      : '暂无可监控设备'
  })
}

async function requestDevice(host) {
  const response = await fetch('/api/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ host, command: READ_COMMAND, timeout: 1600 }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || '本地桥接请求失败')
  if (!cleanText(data.response)) throw new Error('设备未返回数据')
  return data.response
}

function removeCachedNameAfterFailure(host) {
  const count = (failureCounts.get(host) || 0) + 1
  if (count < 2) {
    failureCounts.set(host, count)
    return ''
  }
  failureCounts.delete(host)
  const names = deviceNames()
  const removed = cleanText(names[host])
  if (!removed) return ''
  delete names[host]
  if (Object.keys(names).length) localStorage.setItem(DEVICE_NAME_STORAGE_KEY, JSON.stringify(names))
  else localStorage.removeItem(DEVICE_NAME_STORAGE_KEY)
  try {
    const saved = JSON.parse(localStorage.getItem(DEVICE_STATUS_HOSTS_STORAGE_KEY) || '[]')
    if (Array.isArray(saved)) {
      const remaining = saved.filter((item) => cleanText(item?.host) !== host)
      if (remaining.length) localStorage.setItem(DEVICE_STATUS_HOSTS_STORAGE_KEY, JSON.stringify(remaining))
      else localStorage.removeItem(DEVICE_STATUS_HOSTS_STORAGE_KEY)
    }
  } catch { /* 状态页继续保留当前离线卡片，重载后清除 */ }
  return removed
}

async function refreshOne(device) {
  const previous = states.get(device.host) || device
  states.set(device.host, { ...previous, status: 'connecting', error: '' })
  render()
  try {
    const response = await requestDevice(device.host)
    failureCounts.delete(device.host)
    try {
      const parsed = parseDeviceResponse(device.host, response)
      const resolvedName = parsed.name || previous.name || device.name
      if (parsed.name) {
        const names = deviceNames()
        names[device.host] = parsed.name
        localStorage.setItem(DEVICE_NAME_STORAGE_KEY, JSON.stringify(names))
      }
      const group = deviceGroups()[resolvedName] || ''
      states.set(device.host, {
        ...previous,
        ...parsed,
        name: resolvedName,
        group,
        status: 'connected',
        updatedAt: timestamp(),
        error: '',
      })
    } catch (error) {
      states.set(device.host, {
        ...previous,
        status: 'warning',
        updatedAt: timestamp(),
        error: `已收到回包，但配置解析失败：${error.message}`,
      })
    }
  } catch (error) {
    const removedName = removeCachedNameAfterFailure(device.host)
    states.set(device.host, {
      ...previous,
      status: 'failed',
      updatedAt: timestamp(),
      error: removedName ? `${error.message}；已移除名称缓存“${removedName}”` : error.message,
    })
  }
  render()
}

async function refreshAll() {
  if (refreshRunning || !devices.length) return
  refreshRunning = true
  refreshButton.disabled = true
  const queue = [...devices]
  await Promise.all(Array.from({ length: Math.min(6, queue.length) }, async () => {
    while (queue.length) await refreshOne(queue.shift())
  }))
  refreshRunning = false
  refreshButton.disabled = false
}

function initialize() {
  loadDevices()
  render()
  refreshAll()
  clearInterval(autoRefreshTimer)
  autoRefreshTimer = setInterval(refreshAll, 60000)
}

refreshButton.onclick = refreshAll
window.addEventListener('resize', render)
window.addEventListener('storage', (event) => {
  if ([DEVICE_NAME_STORAGE_KEY, DEVICE_GROUP_STORAGE_KEY, DEVICE_STATUS_HOSTS_STORAGE_KEY, DEVICE_RUNTIME_STORAGE_KEY].includes(event.key)) {
    const firstVisibleHost = devices[page * pageSize]?.host
    loadDevices()
    const firstIndex = Math.max(0, devices.findIndex((device) => device.host === firstVisibleHost))
    page = Math.floor(firstIndex / pageSize)
    render()
  }
})
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshAll()
})

initialize()
