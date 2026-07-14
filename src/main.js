import './styles.css'
import QRCode from 'qrcode'
import jsQR from 'jsqr'

const FIELDS = ['小时', '分钟', '白光', '深蓝光', '绿色光', 'UV', '浅蓝光', '红色光']
const LIGHT_FIELDS = ['白光', '深蓝光', '绿色光', 'UV', '浅蓝光', '红色光']
const DEFAULT_MANUAL_HEADER = '323232323232'
const SUN_PROFILE_STORAGE_KEY = 'np-web-sun-profiles-v1'
const LIGHTING_SCHEME_STORAGE_KEY = 'np-web-lighting-schemes-v1'
const COMPACT_LAYOUT_BREAKPOINT = 1500
const LIMITS = {
  '小时': [0, 23], '分钟': [0, 59],
  '白光': [0, 100], '深蓝光': [0, 100], '绿色光': [0, 100],
  'UV': [0, 100], '浅蓝光': [0, 100], '红色光': [0, 100]
}
const DEFAULT_GROUPS = [
  "0000000000000000","0100000000000000","0200000000000000","0300000000000000",
  "0400000000000000","0500000000000000","0600000000000000","0700000000000000",
  "0800000000000000","0900051414141400","0a000a2828282805","0b001e5a5a465a14",
  "0c001e5a5a465a14","0d001e5a5a465a14","0e001e5a5a465a14","0f001e5a5a465a14",
  "10001e5a5a465a14","11001e5a5a465a14","12001e5a5a465a14","13000a2828282805",
  "1400051414141400","1500000000000000","1600000000000000","1700000000000000",
]
const SPS_GROUPS = [
  "0000000000000000","0100000000000000","0200000000000000","0300000000000000",
  "0400000000000000","0500000000000000","0600000000000000","0700000000000000",
  "0800000000000000","09001e1e1e1e1e1e","0a00323232323232","0b005f5f5f5f5f5f",
  "0c005f5f5f5f5f5f","0d005f5f5f5f5f5f","0e005f5f5f5f5f5f","0f005f5f5f5f5f5f",
  "10005f5f5f5f5f5f","11005f5f5f5f5f5f","12005f5f5f5f5f5f","1300323232323232",
  "14001e1e1e1e1e1e","1500000000000000","1600000000000000","1700000000000000",
]

const LPS_GROUPS = [
  "0000000000000000","0100000000000000","0200000000000000","0300000000000000",
  "0400000000000000","0500000000000000","0600000000000000","0700000000000000",
  "0800000000000000","0900000a00030a00","0a00011e14051e00","0b000550320a5000",
  "0c000550320a5000","0d000550320a5000","0e000550320a5000","0f000550320a5000",
  "10000550320a5000","11000550320a5000","12000550320a5000","1300011e14051e00",
  "1400000a00030a00","1500000000000000","1600000000000000","1700000000000000",
]

const COLORS = {
  '白光': ['#e2e8f0', '#cbd5e1'],
  '深蓝光': ['#dbeafe', '#60a5fa'],
  '绿色光': ['#dcfce7', '#4ade80'],
  'UV': ['#ede9fe', '#a78bfa'],
  '浅蓝光': ['#cffafe', '#22d3ee'],
  '红色光': ['#fee2e2', '#f87171'],
}

const state = {
  rows: [],
  qrVisible: true,
  rawVisible: false,
  manualHeader: DEFAULT_MANUAL_HEADER,
  headerInputs: {},
  manualSliders: {},
  sunTimes: null,
  suspendLightingSchemeReset: false,
  compactChartVisible: false,
}

const app = document.getElementById('app')
app.innerHTML = `
<div class="app">
  <div class="layout" id="layout">
    <div class="left-col editor-only">
      <div class="card editor-card">
        <div class="card-head">
          <div class="card-head-row">
            <div>
              <div class="card-title">24 组时间点编辑</div>
              <div class="card-sub">分钟可填，光通道用彩色条形滑块调节，改动后二维码自动刷新</div>
            </div>
            <button id="btnToggleEditorChart" class="compact-switch">切换到照明曲线</button>
          </div>
        </div>
        <div class="card-body table-wrap">
          <table>
            <colgroup>
              <col style="width:150px" />
              <col style="width:65px" />
              <col style="width:65px" />
              <col style="width:65px" />
              <col />
              <col />
              <col />
              <col />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th class="group-neutral">合成数据</th>
                <th class="group-neutral">小时</th>
                <th class="group-neutral">分钟</th>
                <th class="group-neutral">向下复制</th>
                <th class="group-white">白光</th>
                <th class="group-blue">深蓝光</th>
                <th class="group-green">绿色光</th>
                <th class="group-violet">UV</th>
                <th class="group-cyan">浅蓝光</th>
                <th class="group-red">红色光</th>
              </tr>
            </thead>
            <tbody id="rows"></tbody>
          </table>
          <div class="manual-inline">
            <div class="manual-inline-title">手动模式六通道亮度</div>
            <div class="manual-head-grid manual-head-grid-inline" id="manualHeadGrid"></div>
          </div>
        </div>
      </div>

      <div class="card chart-card">
        <div class="card-head">
          <div class="card-head-row">
            <div>
              <div class="card-title">照明曲线预览</div>
              <div class="card-sub">按 24 个时间点预览白光、蓝光、绿光、紫光、浅蓝、红光的亮度变化</div>
            </div>
            <button id="btnShowEditorPanel" class="compact-switch">切换到时间点编辑</button>
          </div>
        </div>
        <div class="card-body chart-card-body">
          <div class="chart-wrap">
            <canvas id="trendChart"></canvas>
          </div>
          <div class="chart-legend" id="chartLegend"></div>
        </div>
      </div>
    </div>

    <div class="mid-col">
      <div class="card lighting-scheme-card">
        <div class="card-head">
          <div class="card-title">照明参数方案</div>
          <div class="card-sub">可直接应用内置方案，也可把当前 24 组照明参数保存为本地方案</div>
        </div>
        <div class="card-body">
          <div class="toolbar-row sun-actions">
            <button id="btnDefault">应用SPS/LPS</button>
            <button id="btnSps">应用 SPS</button>
            <button id="btnLps">应用 LPS</button>
          </div>
          <div class="sun-grid sun-grid-3">
            <label class="sun-item sun-item-wide">
              <span>本地方案</span>
              <select id="lightingSchemeSelect" class="sun-input"></select>
            </label>
            <label class="sun-item sun-item-wide">
              <span>方案名称</span>
              <input id="lightingSchemeName" class="sun-input" type="text" placeholder="如 我的SPS黄昏版" />
            </label>
          </div>
          <div class="toolbar-row sun-actions">
            <button id="btnSaveLightingScheme">保存当前方案</button>
            <button id="btnDeleteLightingScheme">删除当前方案</button>
            <button id="btnExportLightingSchemes">导出到本地</button>
            <label class="file-label toolbar-btn">从本地导入<input id="lightingSchemeFile" type="file" accept="application/json,.json" /></label>
          </div>
        </div>
      </div>

      <div class="card sun-profile-card">
        <div class="card-head">
          <div class="card-title">模拟日出日落</div>
          <div class="card-sub">可直接填写开灯和关灯时间，或按经纬度与时区计算，用于模拟日出日落节奏并保存为常用预设</div>
        </div>
        <div class="card-body">
          <div class="sun-grid sun-grid-3">
            <label class="sun-item sun-item-wide">
              <span>常用预设</span>
              <select id="sunProfileSelect" class="sun-input"></select>
            </label>
            <label class="sun-item">
              <span>预设名称</span>
              <input id="sunProfileName" class="sun-input" type="text" placeholder="如 广州阳台" />
            </label>
            <label class="sun-item">
              <span>时区</span>
              <input id="sunTimezone" class="sun-input" type="text" placeholder="+08:00" />
            </label>
          </div>
          <div class="toolbar-row sun-actions">
            <button id="btnSaveSunProfile">保存预设</button>
            <button id="btnDeleteSunProfile">删除预设</button>
            <button id="btnExportSunProfiles">导出到本地</button>
            <label class="file-label toolbar-btn">从本地导入<input id="sunProfileFile" type="file" accept="application/json,.json" /></label>
          </div>
          <div class="sun-grid">
            <label class="sun-item">
              <span>开灯时间</span>
              <input id="sunriseTime" class="sun-input" type="time" />
            </label>
            <label class="sun-item">
              <span>关灯时间</span>
              <input id="sunsetTime" class="sun-input" type="time" />
            </label>
          </div>
          <div class="sun-grid">
            <label class="sun-item">
              <span>纬度</span>
              <input id="sunLatText" class="sun-input" type="text" placeholder="23.1291 或 23°07'45&quot;N" />
            </label>
            <label class="sun-item">
              <span>经度</span>
              <input id="sunLonText" class="sun-input" type="text" placeholder="113.2644 或 113°15'52&quot;E" />
            </label>
          </div>
          <div class="toolbar-row sun-actions">
            <button id="btnCalcSunFromCoord">按经纬度计算时间</button>
            <button id="btnApplySun">应用到当前方案</button>
          </div>
        </div>
      </div>

    </div>

    <div class="right-col">
      <div class="card footer-card">
        <div class="card-body footer-body">
          <div class="footer-line"><strong>Author:</strong> OpenAI ChatGPT · GPT-5.6 Sol</div>
          <div class="footer-line"><strong>Creator:</strong> <a href="https://github.com/MualaniMarine/ThaloConsole" target="_blank" rel="noopener noreferrer">Thalograph: MualaniMarine</a></div>
          <div class="footer-line"><strong>Copyright:</strong> © 2026 Thalograph All rights reserved.</div>
          <div class="footer-line"><strong>Official Website:</strong> <a href="https://www.noo-psyche.com/" target="_blank" rel="noopener noreferrer">https://www.noo-psyche.com/</a></div>
          <div class="footer-line">“Noo-Psyche”及其相关名称、标识、品牌识别元素，为佛山纽斯科技有限公司及其相关权利人所拥有、使用或主张权利的品牌名称、商标、商号或相关商业标识。</div>
          <div class="footer-line">本项目为便捷使用与兼容性目的制作的非官方可视化控制台；除非相关权利人另有明确声明，否则不代表官方应用或官方背书产品。</div>
        </div>
      </div>

      <div class="qr-side" id="qrPanel">
        <div class="card qr-card">
          <div class="card-head">
            <div class="card-title">二维码预览</div>
            <div class="card-sub">数据变化后自动刷新，可直接保存 PNG</div>
          </div>
          <div class="card-body qr-wrap">
            <canvas id="qrCanvas"></canvas>
          </div>
        </div>
      </div>

      <div class="card" id="operationCard">
        <div class="card-head">
          <div class="card-title">操作区</div>
          <div class="card-sub">导入、导出、预览开关和快捷操作</div>
        </div>
        <div class="card-body">
          <div class="toolbar-grid">
            <button id="btnRefresh">刷新合成数据</button>
            <button id="btnImportRaw">从原始串/报文导入</button>
            <label class="file-label toolbar-btn">从二维码导入<input id="qrFile" type="file" accept="image/*" /></label>
            <button id="btnCopyRaw">复制原始串</button>
            <button id="btnSaveQr">保存二维码PNG</button>
            <button id="btnToggleQr">显示/隐藏二维码</button>
            <button id="btnToggleRaw">显示/隐藏原始串</button>
            <button id="btnToggleDevicePanel">显示/隐藏灯具连接</button>
          </div>
          <div class="operation-output" aria-label="操作输出">
            <div class="operation-output-row"><span>编辑器</span><strong id="status">已就绪</strong></div>
            <div class="operation-output-row"><span>日出日落</span><strong id="sunInfo">等待日出日落操作…</strong></div>
            <div class="operation-output-row"><span>灯具</span><strong id="deviceStatus">本地桥接服务检测中…</strong></div>
          </div>
        </div>
      </div>

      <div class="card hidden" id="rawCard">
        <div class="card-head">
          <div class="card-title">汇总 / 原始串</div>
          <div class="card-sub">完整格式：12 位手动亮度头 + # + 24 组 16 位合成数据</div>
        </div>
        <div class="card-body">
          <textarea id="rawBox" class="raw-box"></textarea>
          <div class="toolbar-row" style="margin-top:8px">
            <button id="btnFromTable">从表格刷新原始串</button>
            <button id="btnApplyRaw">从原始串回填表格</button>
          </div>
          <div class="muted" id="lengthInfo"></div>
        </div>
      </div>

      </div>
      </div>
</div>
`

// 右侧工具列固定顺序：操作区 → 二维码 → 原始串（显示时）→ 版权信息。
const rightToolsColumn = document.querySelector('.right-col')
rightToolsColumn.append(
  document.getElementById('operationCard'),
  document.getElementById('qrPanel'),
  document.getElementById('rawCard'),
  rightToolsColumn.querySelector('.footer-card'),
)

function clamp(v, lo, hi) {
  const n = Number.parseInt(v, 10)
  if (Number.isNaN(n)) return lo
  return Math.max(lo, Math.min(hi, n))
}
function cleanText(text) { return String(text || '').replace(/\t|\r|\n/g, '').trim() }
function parseHexByte(text) { return Number.parseInt(text, 16) }
function decimalToHexByte(value) { return clamp(value, 0, 100).toString(16).padStart(2, '0') }
function formatMinutes(totalMinutes) {
  const mins = Math.max(0, Math.min(1439, Math.round(totalMinutes)))
  const hour = Math.floor(mins / 60)
  const minute = mins % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}
function parseTimeInput(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''))
  if (!match) throw new Error('时间格式必须是 HH:MM')
  const hour = Number.parseInt(match[1], 10)
  const minute = Number.parseInt(match[2], 10)
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) throw new Error('时间超出有效范围')
  return hour * 60 + minute
}
function getBrowserTimezoneOffsetText() {
  const minutes = -new Date().getTimezoneOffset()
  const sign = minutes >= 0 ? '+' : '-'
  const abs = Math.abs(minutes)
  const hour = Math.floor(abs / 60)
  const minute = abs % 60
  return `${sign}${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}
function parseTimezoneOffset(value) {
  const text = cleanText(value)
  const match = /^([+-])(\d{2})(?::?(\d{2}))?$/.exec(text)
  if (!match) throw new Error('时区格式必须是 +08:00 或 -0530')
  const sign = match[1] === '+' ? 1 : -1
  const hour = Number.parseInt(match[2], 10)
  const minute = Number.parseInt(match[3] || '00', 10)
  if (hour > 14 || minute > 59) throw new Error('时区偏移超出有效范围')
  return sign * (hour + minute / 60)
}
function toRadians(deg) { return deg * Math.PI / 180 }
function toDegrees(rad) { return rad * 180 / Math.PI }
function getSunProfiles() {
  try {
    const raw = localStorage.getItem(SUN_PROFILE_STORAGE_KEY)
    const list = JSON.parse(raw || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}
function setSunProfiles(list) {
  localStorage.setItem(SUN_PROFILE_STORAGE_KEY, JSON.stringify(list))
}
function getLightingSchemes() {
  try {
    const raw = localStorage.getItem(LIGHTING_SCHEME_STORAGE_KEY)
    const list = JSON.parse(raw || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}
function setLightingSchemes(list) {
  localStorage.setItem(LIGHTING_SCHEME_STORAGE_KEY, JSON.stringify(list))
}
function downloadJsonFile(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
async function readJsonFile(file) {
  if (!file) throw new Error('未选择文件')
  const text = await file.text()
  return JSON.parse(text)
}
function normalizeImportedLightingSchemes(payload) {
  const list = Array.isArray(payload) ? payload : payload?.schemes
  if (!Array.isArray(list)) throw new Error('照明参数方案文件格式无效')
  return list.map((item) => {
    const name = cleanText(item?.name)
    if (!name) throw new Error('照明参数方案缺少名称')
    const manualHeader = normalizeManualHeader(item?.manualHeader || '')
    if (!Array.isArray(item?.groups) || item.groups.length !== 24) {
      throw new Error(`照明参数方案“${name}”的分组数不是 24`)
    }
    const groups = item.groups.map((group) => {
      const text = cleanText(group).toLowerCase()
      parseGroup(text)
      return text
    })
    return { name, manualHeader, groups }
  })
}
function normalizeImportedSunProfiles(payload) {
  const list = Array.isArray(payload) ? payload : payload?.profiles
  if (!Array.isArray(list)) throw new Error('日出日落预设文件格式无效')
  return list.map((item) => {
    const name = cleanText(item?.name)
    if (!name) throw new Error('日出日落预设缺少名称')
    const sunrise = clamp(item?.sunrise, 0, 1439)
    const sunset = clamp(item?.sunset, 0, 1439)
    if (sunrise === sunset) throw new Error(`日出日落预设“${name}”的开灯和关灯时间不能相同`)
    const timezoneText = cleanText(item?.timezoneText || getBrowserTimezoneOffsetText())
    parseTimezoneOffset(timezoneText)
    return {
      name,
      latText: cleanText(item?.latText || ''),
      lonText: cleanText(item?.lonText || ''),
      timezoneText,
      sunrise,
      sunset,
    }
  })
}
function parseCoordinate(text, kind) {
  const raw = cleanText(text).toUpperCase()
  if (!raw) throw new Error(`${kind}不能为空`)

  const decimalMatch = raw.match(/^[NSEW]?[\+\-]?\d+(?:\.\d+)?[NSEW]?$/)
  if (decimalMatch) {
    let sign = 1
    if (/[SW]/.test(raw)) sign = -1
    if (/^-/.test(raw)) sign = -1
    const value = Number.parseFloat(raw.replace(/[NSEW]/g, ''))
    if (!Number.isFinite(value)) throw new Error(`${kind}格式无效`)
    return sign * Math.abs(value)
  }

  const dirMatch = raw.match(/[NSEW]/)
  const direction = dirMatch ? dirMatch[0] : ''
  const nums = raw.match(/\d+(?:\.\d+)?/g)
  if (!nums || nums.length < 1) throw new Error(`${kind}格式无效`)
  const deg = Number.parseFloat(nums[0] || '0')
  const min = Number.parseFloat(nums[1] || '0')
  const sec = Number.parseFloat(nums[2] || '0')
  let value = deg + min / 60 + sec / 3600
  if (direction === 'S' || direction === 'W') value *= -1
  if (/^-/.test(raw)) value *= -1
  return value
}
function calculateSunEvent(isSunrise, lat, lon, timezoneOffsetHours) {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((now - start) / 86400000)
  const lngHour = lon / 15
  const t = dayOfYear + ((isSunrise ? 6 : 18) - lngHour) / 24
  const M = 0.9856 * t - 3.289
  let L = M + 1.916 * Math.sin(toRadians(M)) + 0.02 * Math.sin(toRadians(2 * M)) + 282.634
  L = ((L % 360) + 360) % 360

  let RA = toDegrees(Math.atan(0.91764 * Math.tan(toRadians(L))))
  RA = ((RA % 360) + 360) % 360
  const Lquadrant = Math.floor(L / 90) * 90
  const RAquadrant = Math.floor(RA / 90) * 90
  RA = (RA + Lquadrant - RAquadrant) / 15

  const sinDec = 0.39782 * Math.sin(toRadians(L))
  const cosDec = Math.cos(Math.asin(sinDec))
  const cosH = (Math.cos(toRadians(90.833)) - sinDec * Math.sin(toRadians(lat))) / (cosDec * Math.cos(toRadians(lat)))

  if (cosH > 1) throw new Error('该坐标当前日期无日出')
  if (cosH < -1) throw new Error('该坐标当前日期无日落')

  let H = isSunrise ? 360 - toDegrees(Math.acos(cosH)) : toDegrees(Math.acos(cosH))
  H /= 15

  const T = H + RA - 0.06571 * t - 6.622
  let UT = T - lngHour
  UT = ((UT % 24) + 24) % 24
  const localHours = UT + timezoneOffsetHours
  return Math.round((((localHours % 24) + 24) % 24) * 60)
}
function calculateSunTimesFromCoordinates(latText, lonText) {
  const lat = parseCoordinate(latText, '纬度')
  const lon = parseCoordinate(lonText, '经度')
  const timezoneText = document.getElementById('sunTimezone').value
  const timezoneOffsetHours = parseTimezoneOffset(timezoneText)
  if (lat < -90 || lat > 90) throw new Error('纬度必须在 -90 到 90 之间')
  if (lon < -180 || lon > 180) throw new Error('经度必须在 -180 到 180 之间')
  return {
    sunrise: calculateSunEvent(true, lat, lon, timezoneOffsetHours),
    sunset: calculateSunEvent(false, lat, lon, timezoneOffsetHours),
    lat,
    lon,
    timezoneText,
  }
}
function normalizeManualHeader(text) {
  const clean = cleanText(text).replace(/#/g, '').toLowerCase()
  if (!/^[0-9a-f]{12}$/.test(clean)) throw new Error('手动模式六通道亮度头必须是 12 位 HEX')
  return clean
}
function normalizeHexStream(text) {
  const clean = cleanText(text).replace(/\s+/g, '').toLowerCase()
  if (!/^[0-9a-f#]+$/.test(clean)) throw new Error('输入包含非 HEX / # 字符')
  return clean
}
function splitRaw(raw) {
  if (!raw.includes('#')) throw new Error('缺少 # 分隔符')
  const [header, payload] = raw.split('#')
  return { header: normalizeManualHeader(header), payload: cleanText(payload).toLowerCase() }
}
function parseDevicePacketBody(clean) {
  if (!clean.startsWith('abaa')) throw new Error('设备报文缺少 abaa 起始标记')
  if (clean.length < 22) throw new Error('设备报文长度不足')

  const header = normalizeManualHeader(clean.slice(8, 20))
  const groupCount = parseInt(clean.slice(20, 22), 16)
  if (!Number.isFinite(groupCount) || groupCount <= 0) throw new Error('设备报文分组数无效')

  const payloadStart = 22
  const payloadEnd = payloadStart + groupCount * 16
  if (clean.length < payloadEnd + 2) throw new Error('设备报文中的时序数据不完整')

  return {
    header,
    payload: clean.slice(payloadStart, payloadEnd),
    source: 'device-packet',
    groupCount,
  }
}
function resolveDevicePacketHex(clean) {
  // A5A1 也可能就是配置包的功能头；能直接解析时绝不移动起点。
  try {
    parseDevicePacketBody(clean)
    return clean
  } catch (firstError) {
    if (!clean.startsWith('abaaa5a1')) throw firstError
  }
  // Socket 可能把 4 字节结果包 ABAAA5A1 与随后的配置包合并交付。
  // 仅当第二个 ABAA 能通过完整报文校验时才剥离前置结果包；否则保留原包解析。
  let candidateStart = clean.indexOf('abaa', 8)
  while (candidateStart >= 0) {
    const candidate = clean.slice(candidateStart)
    try {
      parseDevicePacketBody(candidate)
      return candidate
    } catch (_) {
      candidateStart = clean.indexOf('abaa', candidateStart + 4)
    }
  }
  throw new Error('设备报文中未找到有效配置包')
}
function parseDevicePacket(raw) {
  return parseDevicePacketBody(resolveDevicePacketHex(normalizeHexStream(raw)))
}
function extractLightingData(raw) {
  const clean = normalizeHexStream(raw)
  if (clean.includes('#')) return { ...splitRaw(clean), source: 'raw-string', groupCount: 24 }
  return parseDevicePacket(clean)
}
function chunk16(payload) {
  if (payload.length % 16 !== 0) throw new Error("'#' 后的数据长度不是 16 的倍数")
  const arr = []
  for (let i = 0; i < payload.length; i += 16) arr.push(payload.slice(i, i + 16))
  return arr
}
function parseGroup(group) {
  if (group.length !== 16) throw new Error('单组长度必须是 16 位')
  const out = []
  for (let i = 0; i < 16; i += 2) out.push(parseInt(group.slice(i, i + 2), 16))
  return out
}
function composeGroup(vals) {
  return vals.map((v, i) => {
    const field = FIELDS[i]
    const [lo, hi] = LIMITS[field]
    return clamp(v, lo, hi).toString(16).padStart(2, '0')
  }).join('')
}
function setStatus(msg) { document.getElementById('status').textContent = msg }

function composeManualHeader() {
  return LIGHT_FIELDS.map((field) => decimalToHexByte(state.headerInputs[field]?.value || 0)).join('')
}

function syncManualHeaderInputs(header = state.manualHeader) {
  LIGHT_FIELDS.forEach((field, idx) => {
    const value = parseHexByte(header.slice(idx * 2, idx * 2 + 2))
    if (state.headerInputs[field]) state.headerInputs[field].value = clamp(value, 0, 100)
    state.manualSliders[field]?.setValue(value, false)
  })
}

function refreshManualHeader(trigger = true) {
  try {
    const header = normalizeManualHeader(composeManualHeader())
    state.manualHeader = header
    syncManualHeaderInputs(header)
    if (trigger) updateRawText()
  } catch (e) {
    setStatus(e.message)
  }
}

function buildManualHeaderEditor() {
  const grid = document.getElementById('manualHeadGrid')
  grid.innerHTML = ''
  state.headerInputs = {}
  state.manualSliders = {}
  LIGHT_FIELDS.forEach((field, idx) => {
    const item = document.createElement('label')
    item.className = 'manual-head-item'
    item.innerHTML = `<span>${field}</span>`
    const input = document.createElement('input')
    input.type = 'hidden'
    input.value = clamp(parseHexByte(state.manualHeader.slice(idx * 2, idx * 2 + 2)), 0, 100)
    const [bg, accent] = COLORS[field]
    const bar = document.createElement('div')
    bar.className = 'bar-slider manual-bar-slider'
    bar.style.background = bg
    bar.innerHTML = `<div class="bar-fill" style="background:${accent}"></div><div class="bar-value">${input.value}</div>`
    const fill = bar.querySelector('.bar-fill')
    const value = bar.querySelector('.bar-value')
    const numberInput = document.createElement('input')
    numberInput.className = 'bar-number-input'
    numberInput.type = 'number'
    numberInput.min = '0'
    numberInput.max = '100'
    numberInput.step = '1'
    numberInput.inputMode = 'numeric'
    numberInput.title = `${field}亮度（0-100）`
    const setValue = (next, trigger = true) => {
      const normalized = clamp(next, 0, 100)
      input.value = normalized
      numberInput.value = normalized
      fill.style.width = `${normalized}%`
      value.textContent = normalized
      if (trigger) refreshManualHeader()
    }
    bar.addEventListener('click', (event) => {
      if (event.target === numberInput) return
      const rect = bar.getBoundingClientRect()
      setValue(Math.round(((event.clientX - rect.left) / rect.width) * 100))
    })
    numberInput.addEventListener('input', () => setValue(numberInput.value))
    numberInput.addEventListener('click', (event) => event.stopPropagation())
    numberInput.addEventListener('wheel', (event) => event.stopPropagation(), { passive: true })
    bar.addEventListener('wheel', (event) => {
      event.preventDefault()
      setValue(Number(input.value) + (event.deltaY < 0 ? 1 : -1))
    }, { passive: false })
    setValue(input.value, false)
    bar.appendChild(numberInput)
    item.append(input, bar)
    grid.appendChild(item)
    state.headerInputs[field] = input
    state.manualSliders[field] = { setValue }
  })
}

function updateSunInfo(text) {
  const el = document.getElementById('sunInfo')
  if (el) el.textContent = text
}
function renderSunProfileOptions() {
  const select = document.getElementById('sunProfileSelect')
  if (!select) return
  const profiles = getSunProfiles()
  select.innerHTML = '<option value="">未选择预设</option>'
  profiles.forEach((profile, index) => {
    const option = document.createElement('option')
    option.value = String(index)
    option.textContent = profile.name
    select.appendChild(option)
  })
}
function renderLightingSchemeOptions() {
  const select = document.getElementById('lightingSchemeSelect')
  if (!select) return
  const schemes = getLightingSchemes()
  select.innerHTML = '<option value="">未选择本地方案</option>'
  schemes.forEach((scheme, index) => {
    const option = document.createElement('option')
    option.value = String(index)
    option.textContent = scheme.name
    select.appendChild(option)
  })
}
function clearLightingSchemeSelectionIfNeeded() {
  if (state.suspendLightingSchemeReset) return
  const select = document.getElementById('lightingSchemeSelect')
  if (!select || !select.value) return
  select.value = ''
}
function fillSunFormFromProfile(profile) {
  document.getElementById('sunProfileName').value = profile.name || ''
  document.getElementById('sunriseTime').value = formatMinutes(profile.sunrise)
  document.getElementById('sunsetTime').value = formatMinutes(profile.sunset)
  document.getElementById('sunLatText').value = profile.latText || ''
  document.getElementById('sunLonText').value = profile.lonText || ''
  document.getElementById('sunTimezone').value = profile.timezoneText || getBrowserTimezoneOffsetText()
  state.sunTimes = { sunrise: profile.sunrise, sunset: profile.sunset }
  updateSunInfo(`已载入预设：${profile.name} | ${document.getElementById('sunTimezone').value} 开灯 ${formatMinutes(profile.sunrise)} | 关灯 ${formatMinutes(profile.sunset)}`)
}
function captureCurrentLightingScheme(name) {
  return {
    name,
    manualHeader: state.manualHeader,
    groups: state.rows.map((row) => composeGroup(FIELDS.map((field) => row.values[field]))),
  }
}
function applyLightingSchemeData(scheme, label = scheme.name) {
  if (!scheme?.manualHeader || !Array.isArray(scheme.groups) || scheme.groups.length !== 24) {
    throw new Error('本地方案数据不完整')
  }
  state.suspendLightingSchemeReset = true
  state.manualHeader = normalizeManualHeader(scheme.manualHeader)
  syncManualHeaderInputs(state.manualHeader)
  scheme.groups.forEach((group, index) => setRowFromGroup(index, group))
  refreshAll()
  state.suspendLightingSchemeReset = false
  renderTrendChart()
  setStatus(`已应用 ${label} 方案`)
}

function readSunTimesFromForm() {
  const sunrise = parseTimeInput(document.getElementById('sunriseTime').value)
  const sunset = parseTimeInput(document.getElementById('sunsetTime').value)
  const timezoneText = cleanText(document.getElementById('sunTimezone').value)
  parseTimezoneOffset(timezoneText)
  if (sunrise === sunset) throw new Error('开灯和关灯时间不能相同')
  const times = { sunrise, sunset }
  state.sunTimes = times
  updateSunInfo(`${timezoneText} 日出 ${formatMinutes(times.sunrise)} | 日落 ${formatMinutes(times.sunset)}`)
  setStatus('已读取手动输入的开灯和关灯时间')
  return times
}
function computeSunTimesFromCoordinateForm() {
  const latText = document.getElementById('sunLatText').value
  const lonText = document.getElementById('sunLonText').value
  const result = calculateSunTimesFromCoordinates(latText, lonText)
  document.getElementById('sunriseTime').value = formatMinutes(result.sunrise)
  document.getElementById('sunsetTime').value = formatMinutes(result.sunset)
  state.sunTimes = { sunrise: result.sunrise, sunset: result.sunset }
  updateSunInfo(`已按经纬度计算 ${result.timezoneText} 开灯 ${formatMinutes(result.sunrise)} | 关灯 ${formatMinutes(result.sunset)}`)
  setStatus('已按经纬度计算时间')
  return result
}
function saveCurrentSunProfile() {
  const name = cleanText(document.getElementById('sunProfileName').value)
  if (!name) throw new Error('请先填写预设名称')
  const times = readSunTimesFromForm()
  const latText = cleanText(document.getElementById('sunLatText').value)
  const lonText = cleanText(document.getElementById('sunLonText').value)
  const timezoneText = cleanText(document.getElementById('sunTimezone').value)
  const profiles = getSunProfiles().filter((item) => item.name !== name)
  profiles.unshift({ name, latText, lonText, timezoneText, sunrise: times.sunrise, sunset: times.sunset })
  setSunProfiles(profiles.slice(0, 20))
  renderSunProfileOptions()
  document.getElementById('sunProfileSelect').value = '0'
  setStatus(`已保存预设：${name}`)
}
function loadSelectedSunProfile() {
  const index = Number.parseInt(document.getElementById('sunProfileSelect').value, 10)
  const profiles = getSunProfiles()
  if (!Number.isInteger(index) || index < 0 || index >= profiles.length) throw new Error('请先选择预设')
  fillSunFormFromProfile(profiles[index])
  setStatus(`已载入预设：${profiles[index].name}`)
}
function deleteSelectedSunProfile() {
  const index = Number.parseInt(document.getElementById('sunProfileSelect').value, 10)
  const profiles = getSunProfiles()
  if (!Number.isInteger(index) || index < 0 || index >= profiles.length) throw new Error('请先选择预设')
  const [removed] = profiles.splice(index, 1)
  setSunProfiles(profiles)
  renderSunProfileOptions()
  document.getElementById('sunProfileName').value = ''
  setStatus(`已删除预设：${removed.name}`)
}
function exportSunProfiles() {
  downloadJsonFile('sun-profiles.json', {
    type: 'np-web-sun-profiles',
    version: 1,
    exportedAt: new Date().toISOString(),
    profiles: getSunProfiles(),
  })
  setStatus('已导出日出日落预设到本地')
}
async function importSunProfiles(file) {
  const payload = await readJsonFile(file)
  const imported = normalizeImportedSunProfiles(payload)
  const merged = [...imported, ...getSunProfiles()].filter((item, index, arr) => (
    arr.findIndex((other) => other.name === item.name) === index
  ))
  setSunProfiles(merged.slice(0, 50))
  renderSunProfileOptions()
  document.getElementById('sunProfileFile').value = ''
  setStatus(`已导入 ${imported.length} 个日出日落预设`)
}
function saveCurrentLightingScheme() {
  const name = cleanText(document.getElementById('lightingSchemeName').value)
  if (!name) throw new Error('请先填写方案名称')
  const schemes = getLightingSchemes().filter((item) => item.name !== name)
  schemes.unshift(captureCurrentLightingScheme(name))
  setLightingSchemes(schemes.slice(0, 20))
  renderLightingSchemeOptions()
  document.getElementById('lightingSchemeSelect').value = '0'
  setStatus(`已保存照明参数方案：${name}`)
}
function loadSelectedLightingScheme() {
  const index = Number.parseInt(document.getElementById('lightingSchemeSelect').value, 10)
  const schemes = getLightingSchemes()
  if (!Number.isInteger(index) || index < 0 || index >= schemes.length) throw new Error('请先选择本地方案')
  document.getElementById('lightingSchemeName').value = schemes[index].name
  applyLightingSchemeData(schemes[index], schemes[index].name)
}
function deleteSelectedLightingScheme() {
  const index = Number.parseInt(document.getElementById('lightingSchemeSelect').value, 10)
  const schemes = getLightingSchemes()
  if (!Number.isInteger(index) || index < 0 || index >= schemes.length) throw new Error('请先选择本地方案')
  const [removed] = schemes.splice(index, 1)
  setLightingSchemes(schemes)
  renderLightingSchemeOptions()
  document.getElementById('lightingSchemeName').value = ''
  setStatus(`已删除照明参数方案：${removed.name}`)
}
function exportLightingSchemes() {
  downloadJsonFile('lighting-schemes.json', {
    type: 'np-web-lighting-schemes',
    version: 1,
    exportedAt: new Date().toISOString(),
    schemes: getLightingSchemes(),
  })
  setStatus('已导出照明参数方案到本地')
}
async function importLightingSchemes(file) {
  const payload = await readJsonFile(file)
  const imported = normalizeImportedLightingSchemes(payload)
  const merged = [...imported, ...getLightingSchemes()].filter((item, index, arr) => (
    arr.findIndex((other) => other.name === item.name) === index
  ))
  setLightingSchemes(merged.slice(0, 50))
  renderLightingSchemeOptions()
  document.getElementById('lightingSchemeFile').value = ''
  setStatus(`已导入 ${imported.length} 个照明参数方案`)
}

function getRowTotalMinutes(row, index) {
  const minute = clamp(row.minuteInput?.value, 0, 59)
  return index * 60 + minute
}

function sampleProfile(rows, sourceIndex) {
  if (!rows.length) return Object.fromEntries(LIGHT_FIELDS.map((field) => [field, 0]))
  if (rows.length === 1) return { ...rows[0] }

  const lo = Math.floor(sourceIndex)
  const hi = Math.min(rows.length - 1, Math.ceil(sourceIndex))
  const ratio = sourceIndex - lo
  const sampled = {}
  for (const field of LIGHT_FIELDS) {
    const a = Number(rows[lo][field] || 0)
    const b = Number(rows[hi][field] || 0)
    sampled[field] = Math.round(a + (b - a) * ratio)
  }
  return sampled
}

function getOrderedActiveIndexes() {
  const activeIndexes = state.rows
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => LIGHT_FIELDS.some((field) => Number(row.values[field] || 0) > 0))
    .map(({ idx }) => idx)
  if (!activeIndexes.length) throw new Error('当前方案没有非零亮度区间')

  let largestGap = -1
  let startOffset = 0
  for (let i = 0; i < activeIndexes.length; i++) {
    const current = activeIndexes[i]
    const next = i === activeIndexes.length - 1 ? activeIndexes[0] + 24 : activeIndexes[i + 1]
    const gap = next - current - 1
    if (gap > largestGap) {
      largestGap = gap
      startOffset = (i + 1) % activeIndexes.length
    }
  }

  return activeIndexes.map((_, offset) => activeIndexes[(startOffset + offset) % activeIndexes.length])
}

function getActiveProfileRows() {
  return getOrderedActiveIndexes().map((idx) => {
    const values = {}
    for (const field of LIGHT_FIELDS) values[field] = Number(state.rows[idx].values[field] || 0)
    return values
  })
}

function buildHourWindow(startHour, endHour) {
  const hours = []
  let current = startHour
  while (current !== endHour) {
    hours.push(current)
    current = (current + 1) % 24
    if (hours.length > 24) throw new Error('开灯和关灯时间区间无效')
  }
  if (!hours.length) hours.push(startHour)
  return hours
}

function applySunAlignment() {
  const times = readSunTimesFromForm()
  const activeRows = getActiveProfileRows()

  const targetStartHour = Math.floor(times.sunrise / 60)
  const targetEndHour = Math.floor(times.sunset / 60)
  const litHours = buildHourWindow(targetStartHour, targetEndHour)
  // The endpoints are always off. Sampling only the hours between them keeps
  // reapplying the same sunrise/sunset settings idempotent.
  const curveHours = litHours.slice(1)
  const targetSpan = Math.max(0, curveHours.length - 1)
  const sourceSpan = Math.max(1, activeRows.length - 1)

  state.rows.forEach((row, idx) => {
    row.minuteInput.value = '0'
    for (const field of LIGHT_FIELDS) {
      row.values[field] = 0
      row.sliders[field].setValue(0, false)
      row.decimalInputs[field].value = 0
    }
  })

  curveHours.forEach((hour, index) => {
    const ratio = targetSpan === 0 ? 0 : index / targetSpan
    const sampled = sampleProfile(activeRows, ratio * sourceSpan)
    for (const field of LIGHT_FIELDS) {
      state.rows[hour].values[field] = sampled[field]
      state.rows[hour].sliders[field].setValue(sampled[field], false)
      state.rows[hour].decimalInputs[field].value = sampled[field]
    }
  })

  state.rows[targetStartHour].minuteInput.value = String(times.sunrise % 60)
  state.rows[targetEndHour].minuteInput.value = String(times.sunset % 60)
  for (const field of LIGHT_FIELDS) {
    state.rows[targetStartHour].values[field] = 0
    state.rows[targetStartHour].sliders[field].setValue(0, false)
    state.rows[targetStartHour].decimalInputs[field].value = 0
    state.rows[targetEndHour].values[field] = 0
    state.rows[targetEndHour].sliders[field].setValue(0, false)
    state.rows[targetEndHour].decimalInputs[field].value = 0
  }
  refreshAll()
  const timezoneText = cleanText(document.getElementById('sunTimezone').value)
  updateSunInfo(`已按 ${timezoneText} 日出 ${formatMinutes(times.sunrise)} / 日落 ${formatMinutes(times.sunset)} 调整当前方案`)
  setStatus('已按日出日落调整当前方案，24 小时结构保持完整')
}


function renderChartLegend() {
  const legend = document.getElementById('chartLegend')
  if (!legend) return
  legend.innerHTML = ''
  for (const field of LIGHT_FIELDS) {
    const item = document.createElement('div')
    item.className = 'chart-legend-item'
    item.innerHTML = `<span class="chart-legend-dot" style="background:${COLORS[field][1]}"></span><span>${field}</span>`
    legend.appendChild(item)
  }
}

function isCompactLayout() {
  return window.innerWidth <= COMPACT_LAYOUT_BREAKPOINT
}

function applyLeftPanelMode() {
  const leftCol = document.querySelector('.left-col')
  const editorBtn = document.getElementById('btnToggleEditorChart')
  const chartBtn = document.getElementById('btnShowEditorPanel')
  if (!leftCol || !editorBtn || !chartBtn) return

  leftCol.classList.toggle('chart-mode', state.compactChartVisible)
  editorBtn.textContent = '切换到照明曲线'
  chartBtn.textContent = '切换到时间点编辑'
}

function applyCompactLayoutMode() {
  const appRoot = document.querySelector('.app')
  const chartCard = document.querySelector('.chart-card')
  if (!appRoot || !chartCard) return

  const compact = isCompactLayout()

  appRoot.classList.toggle('compact-layout', compact)
  applyLeftPanelMode()

  if (compact) {
    chartCard.style.height = ''
  }
}

function syncChartCardHeight() {
  if (isCompactLayout()) return
  const midCol = document.querySelector('.mid-col')
  const rightCol = document.querySelector('.right-col')
  const chartCard = document.querySelector('.chart-card')
  if (!chartCard) return

  const chartRect = chartCard.getBoundingClientRect()
  const bottoms = [midCol, rightCol]
    .filter(Boolean)
    .map((el) => el.getBoundingClientRect().bottom)
  if (!bottoms.length) return
  const targetBottom = Math.max(...bottoms)
  const target = Math.max(220, Math.floor(targetBottom - chartRect.top))

  chartCard.style.height = `${target}px`
}

function syncWorkspaceColumnHeights() {
  const layout = document.getElementById('layout')
  const editorCard = document.querySelector('.editor-card')
  if (!layout || !editorCard) return
  if (window.innerWidth <= COMPACT_LAYOUT_BREAKPOINT) {
    layout.style.removeProperty('--editor-card-height')
    return
  }
  const height = Math.ceil(editorCard.getBoundingClientRect().height)
  if (height > 0) layout.style.setProperty('--editor-card-height', `${height}px`)
}

function renderTrendChart() {
  const canvas = document.getElementById('trendChart')
  if (!canvas) return
  const dpr = Math.max(1, window.devicePixelRatio || 1)
  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return
  const width = Math.max(300, Math.floor(rect.width))
  const height = Math.max(240, Math.floor(rect.height))
  canvas.width = Math.floor(width * dpr)
  canvas.height = Math.floor(height * dpr)
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  const pad = { top: 20, right: 18, bottom: 28, left: 34 }
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom

  // background
  ctx.fillStyle = '#fbfdff'
  ctx.fillRect(0, 0, width, height)

  // grid + y labels
  ctx.strokeStyle = '#e6edf5'
  ctx.lineWidth = 1
  ctx.fillStyle = '#64748b'
  ctx.font = '12px Microsoft YaHei UI, sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let i = 0; i <= 5; i++) {
    const value = 100 - i * 20
    const y = pad.top + (i / 5) * plotH
    ctx.beginPath()
    ctx.moveTo(pad.left, y)
    ctx.lineTo(width - pad.right, y)
    ctx.stroke()
    ctx.fillText(String(value), pad.left - 6, y)
  }

  // x axis labels
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const steps = state.rows.length || 24
  for (let i = 0; i < steps; i++) {
    const x = pad.left + (steps === 1 ? 0 : (i / (steps - 1)) * plotW)
    if (steps <= 12 || i % 2 === 0) {
      ctx.fillStyle = '#64748b'
      ctx.fillText(String(i), x, height - pad.bottom + 8)
    }
  }

  // axes
  ctx.strokeStyle = '#cbd5e1'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(pad.left, pad.top)
  ctx.lineTo(pad.left, height - pad.bottom)
  ctx.lineTo(width - pad.right, height - pad.bottom)
  ctx.stroke()

  // lines
  for (const field of LIGHT_FIELDS) {
    const color = COLORS[field][1]
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()
    state.rows.forEach((row, idx) => {
      const v = Number(row.values[field] || 0)
      const x = pad.left + (steps === 1 ? 0 : (idx / (steps - 1)) * plotW)
      const y = pad.top + (1 - v / 100) * plotH
      if (idx === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()

    // points
    ctx.fillStyle = color
    state.rows.forEach((row, idx) => {
      const v = Number(row.values[field] || 0)
      const x = pad.left + (steps === 1 ? 0 : (idx / (steps - 1)) * plotW)
      const y = pad.top + (1 - v / 100) * plotH
      ctx.beginPath()
      ctx.arc(x, y, 2.5, 0, Math.PI * 2)
      ctx.fill()
    })
  }
}

function makeBar(field, rowIdx) {
  const [bg, accent] = COLORS[field]
  const wrap = document.createElement('div')
  wrap.className = 'bar-slider table-bar-slider'
  wrap.style.background = bg
  wrap.innerHTML = `<div class="bar-fill" style="background:${accent}"></div><div class="bar-value">0</div>`
  const fill = wrap.querySelector('.bar-fill')
  const val = wrap.querySelector('.bar-value')
  const numberInput = document.createElement('input')
  numberInput.className = 'bar-number-input'
  numberInput.type = 'number'
  numberInput.min = '0'
  numberInput.max = '100'
  numberInput.step = '1'
  numberInput.inputMode = 'numeric'
  numberInput.title = `${field}亮度（0-100）`
  numberInput.value = '0'

  const setValue = (n, trigger=true) => {
    n = clamp(n, 0, 100)
    fill.style.width = `${n}%`
    val.textContent = n
    numberInput.value = n
    state.rows[rowIdx].values[field] = n
    if (state.rows[rowIdx].decimalInputs[field]) {
      state.rows[rowIdx].decimalInputs[field].value = n
    }
    if (trigger) refreshRow(rowIdx)
  }

  wrap.addEventListener('click', (e) => {
    if (e.target === numberInput) return
    const rect = wrap.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    setValue(Math.round(ratio * 100))
  })
  wrap.addEventListener('wheel', (e) => {
    e.preventDefault()
    setValue((state.rows[rowIdx].values[field] || 0) + (e.deltaY < 0 ? 1 : -1))
  }, { passive: false })
  numberInput.addEventListener('input', () => setValue(numberInput.value))
  numberInput.addEventListener('click', (e) => e.stopPropagation())
  wrap.appendChild(numberInput)

  return { el: wrap, setValue, input: numberInput }
}

function buildRows() {
  const tbody = document.getElementById('rows')
  tbody.innerHTML = ''
  state.rows = []

  for (let r = 0; r < 24; r++) {
    const tr = document.createElement('tr')
    const row = { values: { '小时': r, '分钟': 0 }, sliders: {}, decimalInputs: {}, composeInput: null }

    const composeTd = document.createElement('td')
    const composeInput = document.createElement('input')
    composeInput.className = 'cell-input'
    composeInput.maxLength = 16
    composeInput.addEventListener('change', () => applyComposeToRow(r))
    composeTd.appendChild(composeInput)
    row.composeInput = composeInput

    const hourTd = document.createElement('td')
    hourTd.innerHTML = `<div class="cell-label">${r}</div>`

    const minuteTd = document.createElement('td')
    const minuteInput = document.createElement('input')
    minuteInput.className = 'cell-input'
    minuteInput.value = '0'
    minuteInput.addEventListener('input', () => refreshRow(r))
    row.values['分钟'] = 0
    minuteTd.appendChild(minuteInput)
    row.minuteInput = minuteInput

    const copyTd = document.createElement('td')
    const copyBtn = document.createElement('button')
    copyBtn.className = 'cell-btn'
    copyBtn.textContent = '↓'
    copyBtn.addEventListener('click', () => copyToNextRow(r))
    copyTd.appendChild(copyBtn)

    tr.append(composeTd, hourTd, minuteTd, copyTd)

    for (const field of LIGHT_FIELDS) {
      row.values[field] = 0
      const td = document.createElement('td')
      const bar = makeBar(field, r)
      td.appendChild(bar.el)
      tr.appendChild(td)
      row.sliders[field] = bar
      row.decimalInputs[field] = bar.input
    }

    tbody.appendChild(tr)
    state.rows.push(row)
  }
}

function refreshRow(r) {
  const row = state.rows[r]
  row.values['小时'] = r
  row.values['分钟'] = clamp(row.minuteInput.value, 0, 59)
  row.minuteInput.value = row.values['分钟']
  for (const field of LIGHT_FIELDS) {
    row.values[field] = clamp(row.values[field], 0, 100)
    row.sliders[field].setValue(row.values[field], false)
    row.decimalInputs[field].value = row.values[field]
  }
  row.composeInput.value = composeGroup(FIELDS.map(f => row.values[f]))
  updateRawText()
  renderTrendChart()
}

function setRowFromGroup(r, group) {
  const vals = parseGroup(group)
  const row = state.rows[r]
  FIELDS.forEach((field, idx) => {
    let v = field === '小时' ? r : vals[idx]
    const [lo, hi] = LIMITS[field]
    v = clamp(v, lo, hi)
    row.values[field] = v
    if (field === '分钟') row.minuteInput.value = v
    if (LIGHT_FIELDS.includes(field)) {
      row.sliders[field].setValue(v, false)
      row.decimalInputs[field].value = v
    }
  })
  row.composeInput.value = composeGroup(FIELDS.map(f => row.values[f]))
}

function applyComposeToRow(r) {
  const text = cleanText(state.rows[r].composeInput.value).toLowerCase()
  if (text.length !== 16) return setStatus(`第 ${r} 行合成数据长度不是 16`)
  try {
    setRowFromGroup(r, text)
    updateRawText()
    renderTrendChart()
    setStatus(`第 ${r} 行已按合成数据回填`)
  } catch (e) {
    setStatus(`第 ${r} 行回填失败: ${e.message}`)
  }
}

function copyToNextRow(r) {
  if (r >= 23) return setStatus('最后一行不能再往下复制')
  const src = state.rows[r]
  const dst = state.rows[r + 1]
  dst.minuteInput.value = src.values['分钟']
  LIGHT_FIELDS.forEach(f => {
    dst.values[f] = src.values[f]
    dst.sliders[f].setValue(src.values[f], false)
    dst.decimalInputs[f].value = src.values[f]
  })
  refreshRow(r + 1)
  setStatus(`已复制第 ${r} 行到第 ${r + 1} 行`)
  renderTrendChart()
}

function updateRawText() {
  clearLightingSchemeSelectionIfNeeded()
  const groups = state.rows.map(r => r.composeInput.value.trim().toLowerCase())
  const raw = `${state.manualHeader}#${groups.join('')}`
  document.getElementById('rawBox').value = raw
  const payloadLen = raw.includes('#') ? raw.split('#')[1].length : 0
  document.getElementById('lengthInfo').textContent = `头部长度: ${state.manualHeader.length} | 总长度: ${raw.length} | 照明参数长度: ${payloadLen} | 分组数: ${Math.floor(payloadLen / 16)}`
  scheduleQrRefresh()
}

let qrJob = null
function scheduleQrRefresh() {
  if (qrJob) clearTimeout(qrJob)
  qrJob = setTimeout(generateQr, 30)
}

async function generateQr() {
  qrJob = null
  const raw = cleanText(document.getElementById('rawBox').value)
  if (!raw) return
  const canvas = document.getElementById('qrCanvas')
  const panel = document.getElementById('qrPanel')
  const sideW = panel?.clientWidth || 360
  const target = Math.max(220, Math.min(520, sideW - 36))
  canvas.width = target
  canvas.height = target
  try {
    await QRCode.toCanvas(canvas, raw, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: target,
      color: { dark: '#000000', light: '#ffffff' }
    })
    setStatus('二维码已自动刷新')
  } catch (e) {
    setStatus('二维码生成失败: ' + e.message)
  }
}

function saveQr() {
  const canvas = document.getElementById('qrCanvas')
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = 'coral_light_qr.png'
  a.click()
}

function applyRawToTable() {
  const raw = cleanText(document.getElementById('rawBox').value)
  try {
    const { header, payload, source, groupCount } = extractLightingData(raw)
    const groups = chunk16(payload)
    if (groups.length !== 24) throw new Error(`当前是 ${groupCount || groups.length} 组，不是 24 组`)
    state.manualHeader = header
    syncManualHeaderInputs(header)
    groups.forEach((g, i) => setRowFromGroup(i, g))
    updateRawText()
    generateQr()
    renderTrendChart()
    setStatus(source === 'device-packet' ? '已从设备报文导入并回填表格' : '已从原始串回填表格')
  } catch (e) {
    alert('导入失败：' + e.message)
  }
}

async function importQrImage(file) {
  if (!file) return
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const result = jsQR(imageData.data, imageData.width, imageData.height)
  if (!result?.data) {
    alert('二维码导入失败：未识别到二维码，请换更清晰的图片再试。')
    return
  }
  document.getElementById('rawBox').value = cleanText(result.data)
  applyRawToTable()
  setStatus('已从二维码图片导入')
}

function toggleQrPanel() {
  state.qrVisible = !state.qrVisible
  document.getElementById('qrPanel').classList.toggle('hidden', !state.qrVisible)
  if (state.qrVisible) generateQr()
  setStatus(state.qrVisible ? '已显示二维码区' : '已隐藏二维码区')
}

function toggleRawPanel() {
  state.rawVisible = !state.rawVisible
  document.getElementById('rawCard').classList.toggle('hidden', !state.rawVisible)
  setStatus(state.rawVisible ? '已显示原始串区' : '已隐藏原始串区')
}

function copyRaw() {
  navigator.clipboard.writeText(cleanText(document.getElementById('rawBox').value))
  setStatus('已复制原始串')
}

function refreshAll() {
  state.rows.forEach((_, i) => refreshRow(i))
  generateQr()
}

function applyPreset(groups, name) {
  applyLightingSchemeData({ manualHeader: state.manualHeader, groups }, name)
}

function loadDefaultData() {
  DEFAULT_GROUPS.forEach((g, i) => setRowFromGroup(i, g))
  refreshAll()
  renderTrendChart()
  setStatus('已载入默认示例')
}

function wireActions() {
  document.getElementById('sunriseTime').value = '06:00'
  document.getElementById('sunsetTime').value = '18:00'
  document.getElementById('sunTimezone').value = getBrowserTimezoneOffsetText()
  renderSunProfileOptions()
  renderLightingSchemeOptions()
  document.getElementById('lightingSchemeSelect').addEventListener('change', () => {
    const value = document.getElementById('lightingSchemeSelect').value
    if (!value) return
    try {
      loadSelectedLightingScheme()
    } catch (e) {
      setStatus(e.message)
    }
  })
  document.getElementById('sunProfileSelect').addEventListener('change', () => {
    const value = document.getElementById('sunProfileSelect').value
    if (!value) return
    try {
      loadSelectedSunProfile()
    } catch (e) {
      setStatus(e.message)
    }
  })
  document.getElementById('btnDefault').onclick = loadDefaultData
  document.getElementById('btnSps').onclick = () => applyPreset(SPS_GROUPS, 'SPS')
  document.getElementById('btnLps').onclick = () => applyPreset(LPS_GROUPS, 'LPS')
  document.getElementById('btnSaveLightingScheme').onclick = () => {
    try {
      saveCurrentLightingScheme()
    } catch (e) {
      setStatus(e.message)
    }
  }
  document.getElementById('btnExportLightingSchemes').onclick = () => {
    try {
      exportLightingSchemes()
    } catch (e) {
      setStatus(e.message)
    }
  }
  document.getElementById('btnDeleteLightingScheme').onclick = () => {
    try {
      deleteSelectedLightingScheme()
    } catch (e) {
      setStatus(e.message)
    }
  }
  document.getElementById('lightingSchemeFile').addEventListener('change', async (e) => {
    try {
      await importLightingSchemes(e.target.files[0])
    } catch (err) {
      setStatus(`导入失败：${err.message}`)
    }
  })
  document.getElementById('btnImportRaw').onclick = () => {
    const raw = prompt('请粘贴完整原始串或设备报文：', cleanText(document.getElementById('rawBox').value) || `${state.manualHeader}#`)
    if (raw != null) {
      document.getElementById('rawBox').value = cleanText(raw)
      applyRawToTable()
    }
  }
  document.getElementById('qrFile').addEventListener('change', (e) => importQrImage(e.target.files[0]))
  document.getElementById('btnToggleQr').onclick = toggleQrPanel
  document.getElementById('btnToggleRaw').onclick = toggleRawPanel
  document.getElementById('btnToggleDevicePanel').onclick = () => {
    deviceColumn.classList.toggle('hidden')
    const hidden = deviceColumn.classList.contains('hidden')
    document.getElementById('layout').classList.toggle('device-column-hidden', hidden)
    setStatus(hidden ? '已隐藏灯具连接与下发' : '已显示灯具连接与下发')
  }
  const toggleLeftPanel = (showChart) => {
    state.compactChartVisible = showChart
    applyLeftPanelMode()
    applyCompactLayoutMode()
    syncChartCardHeight()
    renderTrendChart()
  }
  document.getElementById('btnToggleEditorChart').onclick = () => {
    toggleLeftPanel(true)
  }
  document.getElementById('btnShowEditorPanel').onclick = () => {
    toggleLeftPanel(false)
  }
  document.getElementById('btnRefresh').onclick = refreshAll
  document.getElementById('btnSaveQr').onclick = saveQr
  document.getElementById('btnCopyRaw').onclick = copyRaw
  document.getElementById('btnFromTable').onclick = refreshAll
  document.getElementById('btnApplyRaw').onclick = applyRawToTable
  document.getElementById('btnCalcSunFromCoord').onclick = () => {
    try {
      computeSunTimesFromCoordinateForm()
    } catch (e) {
      setStatus(e.message)
    }
  }
  document.getElementById('btnApplySun').onclick = () => {
    try {
      applySunAlignment()
    } catch (e) {
      setStatus(e.message)
    }
  }
  document.getElementById('btnSaveSunProfile').onclick = () => {
    try {
      saveCurrentSunProfile()
    } catch (e) {
      setStatus(e.message)
    }
  }
  document.getElementById('btnExportSunProfiles').onclick = () => {
    try {
      exportSunProfiles()
    } catch (e) {
      setStatus(e.message)
    }
  }
  document.getElementById('btnDeleteSunProfile').onclick = () => {
    try {
      deleteSelectedSunProfile()
    } catch (e) {
      setStatus(e.message)
    }
  }
  document.getElementById('sunProfileFile').addEventListener('change', async (e) => {
    try {
      await importSunProfiles(e.target.files[0])
    } catch (err) {
      setStatus(`导入失败：${err.message}`)
    }
  })
  document.getElementById('rawBox').addEventListener('input', scheduleQrRefresh)
  window.addEventListener('resize', scheduleQrRefresh)
}

buildRows()
buildManualHeaderEditor()
wireActions()
renderChartLegend()
loadDefaultData()
applyCompactLayoutMode()
syncChartCardHeight()
syncWorkspaceColumnHeights()
const chartWrap = document.querySelector('.chart-wrap')
if (chartWrap && 'ResizeObserver' in window) {
  const resizeObserver = new ResizeObserver(() => {
    applyCompactLayoutMode()
    syncChartCardHeight()
    syncWorkspaceColumnHeights()
    renderTrendChart()
  })
  resizeObserver.observe(chartWrap)
  const midCol = document.querySelector('.mid-col')
  if (midCol) resizeObserver.observe(midCol)
  const rightCol = document.querySelector('.right-col')
  if (rightCol) resizeObserver.observe(rightCol)
  const rawCard = document.getElementById('rawCard')
  if (rawCard) resizeObserver.observe(rawCard)
  const editorCard = document.querySelector('.editor-card')
  if (editorCard) resizeObserver.observe(editorCard)
}
window.addEventListener('resize', () => {
  applyCompactLayoutMode()
  syncChartCardHeight()
  syncWorkspaceColumnHeights()
  renderTrendChart()
})

// 本地桥接层：浏览器不能直接创建 TCP Socket，因此由同源的 Node 服务完成扫描与下发。
const devicePanel = document.createElement('div')
devicePanel.className = 'card device-card'
devicePanel.innerHTML = `
  <div class="card-head"><div class="card-title">灯具连接与控制</div><div class="card-sub">局域网扫描或 AP 模式指定 IP；TCP 8266</div></div>
  <div class="card-body">
    <div class="device-connection-summary">
      <div class="device-summary-item"><span>当前连接设备名称</span><strong id="currentDeviceName">—</strong></div>
      <div class="device-summary-item device-connection-state"><span>连接状态</span><strong id="currentConnectionState" data-state="idle"><i aria-hidden="true"></i>未连接</strong></div>
    </div>
    <div class="sun-grid"><label class="sun-item"><span>设备 IP</span><input id="deviceHost" class="sun-input" value="192.168.4.1" inputmode="decimal" /></label><label class="sun-item"><span>扫描网段（可选）</span><input id="deviceSubnet" class="sun-input" placeholder="例如 192.168.1" inputmode="decimal" /></label></div>
    <div class="toolbar-grid"><button id="btnDeviceScan">扫描局域网</button><button id="btnClearDeviceCache" title="清除本机保存的灯具名称缓存">清理缓存设备</button><button id="btnDeviceRead">读取配置</button><button id="btnDevicePush">发送当前配置</button><button id="btnSendManual">发送当前亮度</button><button id="btnDeviceSync">同步时间</button><button id="btnAutoMode">切换自动模式</button><button id="btnManualMode">切换手动模式</button><button id="btnDemoOn">开启演示模式</button><button id="btnDemoOff">关闭演示模式</button></div>
    <div class="device-list-head"><i aria-hidden="true"></i><span>可连接灯具 · <strong id="deviceListCount">0 台</strong></span><i aria-hidden="true"></i></div>
    <div id="deviceList" class="muted"></div><div id="devicePagination" class="device-pagination"></div>
    <div class="device-log-head"><span>报文日志</span><span><button id="btnExportDeviceLog" type="button">导出</button><button id="btnClearDeviceLog" type="button">清空</button></span></div><pre id="deviceLog" class="device-log">等待设备通信…</pre>
  </div>`
const deviceColumn = document.createElement('div')
deviceColumn.className = 'device-col'
deviceColumn.append(devicePanel)
document.querySelector('.layout').insertBefore(deviceColumn, document.querySelector('.right-col'))

const deviceStatus = document.getElementById('deviceStatus')
const deviceHost = document.getElementById('deviceHost')
const deviceSubnet = document.getElementById('deviceSubnet')
const currentDeviceName = document.getElementById('currentDeviceName')
const currentConnectionState = document.getElementById('currentConnectionState')
const deviceList = document.getElementById('deviceList')
const deviceListCount = document.getElementById('deviceListCount')
const deviceButtons = new Map()
const devicePagination = document.getElementById('devicePagination')
const deviceLog = document.getElementById('deviceLog')
const DEVICE_PAGE_MAX_ITEMS = 60
const DEVICE_PAGE_MAX_ROWS = 30
const DEVICE_NATURAL_LAYOUT_MAX_ROWS = 8
const MAX_DEVICE_LOGS = 200
const DEVICE_LOG_HEIGHT = 220
const DEVICE_LIST_ROW_GAP = 5
const DEVICE_LIST_ROW_PITCH = 45
let scannedDevices = []
let devicePage = 0
let packetLogs = []
let connectedHost = ''
let deviceLayoutFrame = 0
let deviceIpFitFrame = 0
let devicePageRowCapacity = null
const DEVICE_NAME_STORAGE_KEY = 'thalo-console-device-names-v1'
const deviceNames = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(DEVICE_NAME_STORAGE_KEY) || '{}')
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}
  } catch { return {} }
})()
const deviceLabel = (host, name) => {
  const resolvedName = name ?? deviceNames[host]
  return resolvedName ? `${host} · ${resolvedName}` : host
}
const cacheDeviceName = (host, name) => {
  if (!name || deviceNames[host] === name) return
  deviceNames[host] = name
  localStorage.setItem(DEVICE_NAME_STORAGE_KEY, JSON.stringify(deviceNames))
}
const currentDeviceCachedName = () => {
  const host = currentHost()
  return scannedDevices.find((device) => device.host === host)?.name ?? deviceNames[host] ?? ''
}
const updateCurrentDeviceSummary = (state = undefined) => {
  const host = currentHost()
  currentDeviceName.textContent = currentDeviceCachedName() || '—'
  const resolvedState = state ?? (host && host === connectedHost ? 'connected' : 'idle')
  const labels = { idle: '未连接', connecting: '连接中', connected: '已连接', failed: '连接失败' }
  currentConnectionState.dataset.state = resolvedState
  currentConnectionState.lastChild.textContent = labels[resolvedState]
}
const updateDeviceButton = (host, name) => {
  if (name) devicePage = 0
  renderDeviceList()
  updateCurrentDeviceSummary()
}
const packetTimestamp = () => {
  const date = new Date()
  const pad = (value, length = 2) => String(value).padStart(length, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
}
const addPacketLog = (direction, host, data) => {
  packetLogs = [...packetLogs, `${packetTimestamp()} ${direction} ${host}  ${data}`].slice(-MAX_DEVICE_LOGS)
  deviceLog.textContent = packetLogs.join('\n') || '等待设备通信…'
  deviceLog.scrollTop = deviceLog.scrollHeight
}
const api = async (path, payload = undefined) => {
  const response = await fetch(path, payload === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || '本地桥接请求失败')
  return data
}
const showDeviceStatus = (value) => {
  deviceStatus.textContent = value
}
const currentHost = () => deviceHost.value.trim()
const sendDevice = async (command, label) => {
  showDeviceStatus(`${label}：正在连接 ${currentHost()}…`)
  const host = currentHost()
  updateCurrentDeviceSummary('connecting')
  addPacketLog('→', host, command.toUpperCase())
  try {
    const result = await api('/api/send', { host, command })
    connectedHost = host
    updateCurrentDeviceSummary('connected')
    addPacketLog('←', host, result.response || '(无返回数据)')
    showDeviceStatus(`${label}完成${result.response ? `，收到 ${result.response}` : '，设备未返回数据'}`)
    return result
  } catch (error) {
    if (connectedHost === host) connectedHost = ''
    updateCurrentDeviceSummary('failed')
    addPacketLog('×', host, error.message)
    throw error
  }
}
const deviceRowCount = (devices) => {
  const hasNamedDevice = devices.some((device) => Boolean(device.name ?? deviceNames[device.host]))
  return Math.ceil(devices.length / (hasNamedDevice ? 2 : 3))
}
const paginateDevices = (devices, maxRows) => {
  const pages = []
  let page = []
  devices.forEach((device) => {
    const candidate = [...page, device]
    if (page.length && (candidate.length > DEVICE_PAGE_MAX_ITEMS || deviceRowCount(candidate) > maxRows)) {
      pages.push(page)
      page = [device]
    } else {
      page = candidate
    }
  })
  if (page.length) pages.push(page)
  return pages
}
const availableDeviceRows = (reservePagination) => {
  if (window.innerWidth <= 1500) return DEVICE_NATURAL_LAYOUT_MAX_ROWS
  const body = devicePanel.querySelector(':scope > .card-body')
  if (!body?.clientHeight) return DEVICE_NATURAL_LAYOUT_MAX_ROWS
  const outerHeight = (element) => {
    const style = getComputedStyle(element)
    return element.offsetHeight + Number.parseFloat(style.marginTop || 0) + Number.parseFloat(style.marginBottom || 0)
  }
  const bodyStyle = getComputedStyle(body)
  const innerHeight = body.clientHeight - Number.parseFloat(bodyStyle.paddingTop || 0) - Number.parseFloat(bodyStyle.paddingBottom || 0)
  const fixedElements = [
    body.querySelector('.device-connection-summary'),
    body.querySelector('.sun-grid'),
    body.querySelector('.toolbar-grid'),
    body.querySelector('.device-list-head'),
    body.querySelector('.device-log-head'),
  ]
  const fixedHeight = fixedElements.reduce((total, element) => total + outerHeight(element), 0)
  const listStyle = getComputedStyle(deviceList)
  const logStyle = getComputedStyle(deviceLog)
  const reservedHeight = DEVICE_LOG_HEIGHT
    + Number.parseFloat(logStyle.marginTop || 0)
    + Number.parseFloat(logStyle.marginBottom || 0)
    + Number.parseFloat(listStyle.marginTop || 0)
    + Number.parseFloat(listStyle.marginBottom || 0)
    + (reservePagination ? 40 : 0)
  const availableHeight = innerHeight - fixedHeight - reservedHeight
  return Math.max(1, Math.min(DEVICE_PAGE_MAX_ROWS, Math.floor((availableHeight + DEVICE_LIST_ROW_GAP) / DEVICE_LIST_ROW_PITCH)))
}
const fitUnnamedDeviceIps = () => {
  cancelAnimationFrame(deviceIpFitFrame)
  deviceIpFitFrame = requestAnimationFrame(() => {
    deviceList.querySelectorAll('.unnamed-device .device-ip').forEach((element) => {
      const fullIp = element.dataset.fullIp
      element.textContent = fullIp
      if (element.scrollWidth <= element.clientWidth) return
      const parts = fullIp.split('.')
      if (parts.length !== 4) return
      element.textContent = parts.slice(-2).join('.')
      if (element.scrollWidth > element.clientWidth) element.textContent = parts.at(-1)
    })
  })
}
function scheduleDeviceListRender(recalculateCapacity = false) {
  cancelAnimationFrame(deviceLayoutFrame)
  if (recalculateCapacity) devicePageRowCapacity = null
  deviceLayoutFrame = requestAnimationFrame(() => renderDeviceList())
}
function renderDeviceList() {
  deviceButtons.clear()
  const devices = [...scannedDevices].sort((a, b) => {
    const aNamed = Boolean(a.name ?? deviceNames[a.host])
    const bNamed = Boolean(b.name ?? deviceNames[b.host])
    return Number(bNamed) - Number(aNamed)
  })
  deviceListCount.textContent = `${devices.length} 台`
  let reservedDeviceRows = devicePageRowCapacity ?? availableDeviceRows(false)
  let pages = paginateDevices(devices, reservedDeviceRows)
  if (devicePageRowCapacity === null && pages.length > 1) {
    reservedDeviceRows = availableDeviceRows(true)
    pages = paginateDevices(devices, reservedDeviceRows)
  }
  devicePageRowCapacity = reservedDeviceRows
  const pageCount = Math.max(1, pages.length)
  devicePage = Math.min(devicePage, pageCount - 1)
  const pageDevices = pages[devicePage] || []
  const stableDeviceRows = devices.length ? Math.max(...pages.map(deviceRowCount)) : 0
  deviceList.style.setProperty('--device-list-reserved-height', `${Math.max(0, stableDeviceRows * DEVICE_LIST_ROW_PITCH - DEVICE_LIST_ROW_GAP)}px`)
  deviceList.classList.toggle('has-named-devices', pageDevices.some((device) => Boolean(device.name ?? deviceNames[device.host])))
  deviceList.replaceChildren(...pageDevices.map((device) => {
    const button = document.createElement('button')
    const name = device.name ?? deviceNames[device.host]
    const ip = document.createElement('span')
    ip.className = 'device-ip'
    ip.dataset.fullIp = device.host
    ip.textContent = device.host
    button.title = deviceLabel(device.host, name)
    if (name) {
      const deviceName = document.createElement('span')
      deviceName.className = 'device-name'
      deviceName.textContent = name
      button.classList.add('known-device')
      button.append(ip, deviceName)
    } else {
      button.classList.add('unnamed-device')
      button.append(ip)
    }
    button.onclick = async () => {
      deviceHost.value = device.host
      updateCurrentDeviceSummary()
      try { await readDeviceConfiguration() } catch (error) { showDeviceStatus(`读取失败：${error.message}`) }
    }
    deviceButtons.set(device.host, button)
    return button
  }))
  fitUnnamedDeviceIps()
  devicePagination.replaceChildren()
  if (pageCount > 1) {
    const previous = document.createElement('button')
    previous.textContent = '上一页'
    previous.disabled = devicePage === 0
    previous.onclick = () => { devicePage--; renderDeviceList() }
    const info = document.createElement('span')
    info.textContent = `${devicePage + 1} / ${pageCount} 页`
    const next = document.createElement('button')
    next.textContent = '下一页'
    next.disabled = devicePage >= pageCount - 1
    next.onclick = () => { devicePage++; renderDeviceList() }
    devicePagination.append(previous, info, next)
  }
}
window.addEventListener('resize', () => scheduleDeviceListRender(true))
if ('ResizeObserver' in window) {
  let observedDevicePanelHeight = 0
  const devicePanelResizeObserver = new ResizeObserver(([entry]) => {
    if (window.innerWidth <= 1500) return
    const height = Math.round(entry.contentRect.height)
    if (!height || height === observedDevicePanelHeight) return
    observedDevicePanelHeight = height
    scheduleDeviceListRender(true)
  })
  devicePanelResizeObserver.observe(devicePanel)
}
const allSetPacket = () => {
  const raw = cleanText(document.getElementById('rawBox').value)
  const { header, payload } = splitRaw(raw)
  const now = new Date()
  const time = [now.getHours(), now.getMinutes(), now.getSeconds()].map((value) => value.toString(16).padStart(2, '0')).join('')
  return `AAA51007${header}18${payload}01${time}BB`
}
const readDeviceConfiguration = async () => {
  const host = currentHost()
  const result = await sendDevice('AAA51008BB', '读取配置')
  if (!result.response?.startsWith('ABAA')) throw new Error('设备未返回 ABAA 配置报文')
  document.getElementById('rawBox').value = result.response
  applyRawToTable()
  const name = readDeviceName(result.response)
  if (name) {
    cacheDeviceName(host, name)
    updateDeviceButton(host, name)
  }
  showDeviceStatus(`已读取并导入灯具配置${name ? `：${name}` : ''}`)
}
document.getElementById('btnDeviceScan').onclick = async () => {
  try {
    showDeviceStatus('正在扫描当前网段的 TCP 8266 设备（与 App 相同，约需数秒）…')
    const result = await api('/api/scan', { subnet: deviceSubnet.value.trim() || undefined })
    deviceSubnet.value = result.subnet
    scannedDevices = result.devices
    devicePage = 0
    showDeviceStatus(result.devices.length ? `发现 ${result.devices.length} 台可连接灯具` : '未发现 TCP 8266 灯具')
    renderDeviceList()
  } catch (error) { showDeviceStatus(`扫描失败：${error.message}`) }
}
document.getElementById('btnClearDeviceCache').onclick = () => {
  const cachedCount = Object.keys(deviceNames).length
  Object.keys(deviceNames).forEach((host) => delete deviceNames[host])
  localStorage.removeItem(DEVICE_NAME_STORAGE_KEY)
  scannedDevices = scannedDevices.map((device) => ({ ...device, name: null }))
  devicePage = 0
  showDeviceStatus(cachedCount ? `已清理 ${cachedCount} 台灯具的名称缓存` : '当前没有缓存设备')
  renderDeviceList()
  updateCurrentDeviceSummary()
}
deviceHost.addEventListener('input', () => updateCurrentDeviceSummary())
updateCurrentDeviceSummary()
document.getElementById('btnDeviceRead').onclick = async () => {
  try { await readDeviceConfiguration() } catch (error) { showDeviceStatus(`读取失败：${error.message}`) }
}
document.getElementById('btnDevicePush').onclick = async () => {
  try { refreshAll(); await sendDevice(allSetPacket(), '发送当前配置') } catch (error) { showDeviceStatus(`发送配置失败：${error.message}`) }
}
document.getElementById('btnDeviceSync').onclick = async () => {
  try {
    const now = new Date()
    const values = [now.getHours(), now.getMinutes(), now.getSeconds()].map((value) => value.toString(16).padStart(2, '0')).join('')
    await sendDevice(`AAA51003${values}BB`, '同步时间')
  } catch (error) { showDeviceStatus(`同步失败：${error.message}`) }
}
document.getElementById('btnAutoMode').onclick = async () => {
  try { await sendDevice('AAA5100401BB', '切换自动模式') } catch (error) { showDeviceStatus(`切换自动模式失败：${error.message}`) }
}
document.getElementById('btnManualMode').onclick = async () => {
  try { await sendDevice('AAA5100400BB', '切换手动模式') } catch (error) { showDeviceStatus(`切换手动模式失败：${error.message}`) }
}
document.getElementById('btnSendManual').onclick = async () => {
  try { refreshManualHeader(); await sendDevice(`AAA51005${state.manualHeader}BB`, '发送当前亮度') } catch (error) { showDeviceStatus(`发送当前亮度失败：${error.message}`) }
}
document.getElementById('btnDemoOn').onclick = async () => {
  try { await sendDevice('AAA5100A00BB', '开启演示模式') } catch (error) { showDeviceStatus(`开启演示模式失败：${error.message}`) }
}
document.getElementById('btnDemoOff').onclick = async () => {
  try { await sendDevice('AAA5100A01BB', '关闭演示模式') } catch (error) { showDeviceStatus(`关闭演示模式失败：${error.message}`) }
}
document.getElementById('btnExportDeviceLog').onclick = () => {
  const blob = new Blob([packetLogs.join('\n') || '等待设备通信…'], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `thalo-packet-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`
  link.click()
  URL.revokeObjectURL(url)
}
document.getElementById('btnClearDeviceLog').onclick = () => {
  packetLogs = []
  deviceLog.textContent = '等待设备通信…'
}
api('/api/health').then((info) => {
  if (info.subnet) deviceSubnet.value = info.subnet
  showDeviceStatus(`本地桥接已就绪；默认扫描 ${info.subnet || '手动指定网段'}.0/24`)
}).catch(() => showDeviceStatus('未检测到本地桥接。请使用 npm run console 启动。'))

function readDeviceName(packet) {
  try {
    const hex = resolveDevicePacketHex(normalizeHexStream(packet))
    if (hex.length < 430) return null
    const bytes = hex.slice(408, 430).match(/.{2}/g).map((part) => Number.parseInt(part, 16))
    const name = new TextDecoder().decode(new Uint8Array(bytes)).replace(/[\0\s]/g, '')
    return name || null
  } catch { return null }
}
