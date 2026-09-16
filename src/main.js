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
            <button id="btnDeleteLightingScheme">删除当前方案</button>
            <button id="btnSaveLightingScheme">保存当前方案</button>
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
            <button id="btnDeleteSunProfile">删除预设</button>
            <button id="btnSaveSunProfile">保存预设</button>
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

      <div class="card cluster-control-entry-card">
        <div class="card-head">
          <div class="card-title">集群控制</div>
          <div class="card-sub">向全部已命名设备或指定分组群发当前配置</div>
        </div>
        <div class="card-body cluster-control-entry-body">
          <div class="cluster-entry-summary" id="clusterEntrySummary">等待设备名称缓存…</div>
          <button id="btnOpenClusterControl" type="button">打开集群控制</button>
        </div>
      </div>

    </div>

    <div class="log-col hidden" id="deviceLogColumn">
      <div class="card device-log-floating-card" id="deviceLogFloatingCard">
        <div class="card-body" id="deviceLogFloatingBody"></div>
      </div>
    </div>

    <div class="right-col">
      <div class="card footer-card">
        <div class="card-body footer-body">
          <div class="footer-line"><strong>Author:</strong> OpenAI ChatGPT · GPT-5.6 Sol</div>
          <div class="footer-line"><strong>Creator:</strong> <a href="https://github.com/MualaniMarine/ThaloConsole" target="_blank" rel="noopener noreferrer">Thalograph: MualaniMarine</a></div>
          <div class="footer-line"><strong>Copyright:</strong> © 2026 Thalograph All rights reserved.</div>
          <div class="footer-line"><strong>Official Website:</strong> <a href="https://www.noo-psyche.com/" target="_blank" rel="noopener noreferrer">https://www.noo-psyche.com/</a></div>
          <div class="footer-line">“Noo-Psyche”及其相关名称、标识、品牌识别元素，为佛山纽斯科技有限公司及其相关权利人所拥有、使用或主张权利的品牌名称或相关商业标识。</div>
          <div class="footer-line">本项目为便捷使用与兼容性目的制作的非官方可视化控制台；除非相关权利人另有明确声明，否则不代表官方应用或官方背书产品。</div>
        </div>
      </div>

      <div class="qr-side" id="qrPanel">
        <div class="card qr-card">
          <div class="card-head">
            <div class="card-head-row">
              <div>
                <div class="card-title">二维码预览</div>
                <div class="card-sub">数据变化后自动刷新</div>
              </div>
              <div class="card-head-actions">
                <button id="btnSaveQr" class="card-head-button" type="button">保存二维码</button>
                <button id="btnHideQrCard" class="card-hide-button" type="button">隐藏</button>
              </div>
            </div>
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
            <button id="btnRefresh" class="hidden">刷新合成数据</button>
            <button id="btnImportRaw">从原始串/报文导入</button>
            <label class="file-label toolbar-btn">从二维码导入<input id="qrFile" type="file" accept="image/*" /></label>
            <button id="btnExportPresetLibrary">导出配置库</button>
            <label class="file-label toolbar-btn" id="presetLibraryImportLabel">导入配置库<input id="presetLibraryFile" type="file" accept="application/json,.json" /></label>
            <button id="btnCopyRaw">复制原始串</button>
            <button id="btnToggleQr" class="hidden">显示二维码</button>
            <button id="btnToggleRaw">显示原始串</button>
            <button id="btnToggleDevicePanel" class="hidden">显示灯具连接</button>
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
          <div class="card-head-row">
            <div>
              <div class="card-title">汇总 / 原始串</div>
              <div class="card-sub">完整格式：12 位手动亮度头 + # + 24 组 16 位合成数据</div>
            </div>
            <button id="btnHideRawCard" class="card-hide-button" type="button">隐藏</button>
          </div>
        </div>
        <div class="card-body">
          <div class="muted raw-summary" id="lengthInfo"></div>
          <div class="toolbar-row raw-actions">
            <button id="btnFromTable">从表格刷新原始串</button>
            <button id="btnApplyRaw">从原始串回填表格</button>
          </div>
          <textarea id="rawBox" class="raw-box" spellcheck="false"></textarea>
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
const operationOutput = document.querySelector('.operation-output')
const operationOutputHome = document.querySelector('#operationCard .card-body')
const rightToolsToggle = document.createElement('button')
rightToolsToggle.id = 'btnToggleRightToolsDrawer'
rightToolsToggle.className = 'right-tools-toggle hidden'
rightToolsToggle.type = 'button'
rightToolsToggle.setAttribute('aria-controls', 'operationCard')
document.querySelector('.app').append(rightToolsToggle)

function setRightToolsDrawer(open) {
  const layout = document.getElementById('layout')
  layout.classList.add('right-tools-drawer-active')
  layout.classList.toggle('right-tools-drawer-open', open)
  rightToolsToggle.classList.remove('hidden')
  rightToolsToggle.textContent = open ? '›' : '‹'
  rightToolsToggle.title = open ? '收起右侧工具' : '展开右侧工具'
  rightToolsToggle.setAttribute('aria-label', rightToolsToggle.title)
  rightToolsToggle.setAttribute('aria-expanded', String(open))

  const liveStatusHome = document.getElementById('deviceLiveStatusHome')
  if (open || !liveStatusHome) {
    operationOutputHome.append(operationOutput)
    operationOutput.classList.remove('relocated-operation-output')
  } else {
    liveStatusHome.append(operationOutput)
    operationOutput.classList.add('relocated-operation-output')
  }
  requestAnimationFrame(() => {
    syncWorkspaceColumnHeights()
    scheduleDeviceListRender(true)
    renderTrendChart()
  })
}
rightToolsToggle.onclick = () => {
  const layout = document.getElementById('layout')
  setRightToolsDrawer(!layout.classList.contains('right-tools-drawer-open'))
}
document.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return
  const layout = document.getElementById('layout')
  if (!layout.classList.contains('right-tools-drawer-open')) return
  if (rightToolsColumn.contains(event.target) || rightToolsToggle.contains(event.target)) return
  setRightToolsDrawer(false)
})
document.addEventListener('keydown', (event) => {
  const layout = document.getElementById('layout')
  if (event.key === 'Escape' && layout.classList.contains('right-tools-drawer-open')) setRightToolsDrawer(false)
})

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
  // 读取时可能一次收到 4 字节确认包 ABAAA5A1，紧接完整配置包 ABAA...。
  // 此时若从第一个 ABAA 解析，“分组数”位置会落到完整包手动亮度头的绿光字节上；
  // 绿光非零时可能误通过长度校验。因此先识别明确的双包边界，并只接受 24 组完整包。
  if (clean.startsWith('abaaa5a1abaa')) {
    const candidate = clean.slice(8)
    try {
      if (parseDevicePacketBody(candidate).groupCount === 24) return candidate
    } catch (_) { /* 再按单包和后续候选继续解析 */ }
  }

  let directPacket = null
  let directError = null
  try {
    directPacket = parseDevicePacketBody(clean)
    if (directPacket.groupCount === 24) return clean
  } catch (error) {
    directError = error
    if (!clean.startsWith('abaaa5a1')) throw error
  }

  // 兼容一个 Socket 响应中出现多个确认包；只选择能解析成 24 组的完整配置包。
  let candidateStart = clean.indexOf('abaa', 8)
  while (candidateStart >= 0) {
    const candidate = clean.slice(candidateStart)
    try {
      if (parseDevicePacketBody(candidate).groupCount === 24) return candidate
    } catch (_) {
      // 继续查找下一个 ABAA 起点。
    }
    candidateStart = clean.indexOf('abaa', candidateStart + 4)
  }
  if (directPacket) return clean
  throw directError || new Error('设备报文中未找到有效配置包')
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

let activeConfirmPopover = null
function closeConfirmPopover() {
  activeConfirmPopover?.close()
}
function openConfirmPopover(anchor, title, message, onConfirm) {
  closeConfirmPopover()
  const popover = document.createElement('div')
  popover.className = 'confirm-popover'
  popover.setAttribute('role', 'dialog')
  popover.setAttribute('aria-modal', 'false')
  popover.innerHTML = `
    <strong class="confirm-popover-title"></strong>
    <div class="confirm-popover-message"></div>
    <div class="confirm-popover-actions">
      <button type="button" class="confirm-popover-cancel">取消</button>
      <button type="button" class="confirm-popover-ok">确认删除</button>
    </div>`
  popover.querySelector('.confirm-popover-title').textContent = title
  popover.querySelector('.confirm-popover-message').textContent = message
  document.body.appendChild(popover)

  const anchorRect = anchor.getBoundingClientRect()
  const popoverRect = popover.getBoundingClientRect()
  const left = Math.min(window.innerWidth - popoverRect.width - 10, Math.max(10, anchorRect.right - popoverRect.width))
  const belowTop = anchorRect.bottom + 10
  const top = belowTop + popoverRect.height <= window.innerHeight - 10
    ? belowTop
    : Math.max(10, anchorRect.top - popoverRect.height - 10)
  popover.style.left = `${left}px`
  popover.style.top = `${top}px`

  const close = () => {
    document.removeEventListener('pointerdown', handleOutside, true)
    document.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('resize', close)
    window.removeEventListener('scroll', close, true)
    popover.remove()
    if (activeConfirmPopover?.popover === popover) activeConfirmPopover = null
  }
  const handleOutside = (event) => {
    if (!popover.contains(event.target) && event.target !== anchor) close()
  }
  const handleKeydown = (event) => {
    if (event.key === 'Escape') close()
  }
  popover.querySelector('.confirm-popover-cancel').onclick = close
  popover.querySelector('.confirm-popover-ok').onclick = () => {
    close()
    try { onConfirm() } catch (error) { setStatus(error.message) }
  }
  document.addEventListener('pointerdown', handleOutside, true)
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', close)
  window.addEventListener('scroll', close, true)
  activeConfirmPopover = { popover, close }
  popover.querySelector('.confirm-popover-cancel').focus()
}

function suggestImportedPresetName(name, usedNames) {
  const base = `${name}（导入）`
  if (!usedNames.has(base)) return base
  let suffix = 2
  while (usedNames.has(`${base}${suffix}`)) suffix += 1
  return `${base}${suffix}`
}

function resolvePresetImportConflict(anchor, categoryLabel, name, usedNames) {
  closeConfirmPopover()
  return new Promise((resolve) => {
    const popover = document.createElement('div')
    popover.className = 'confirm-popover import-conflict-popover'
    popover.setAttribute('role', 'dialog')
    popover.setAttribute('aria-modal', 'false')
    popover.innerHTML = `
      <strong class="confirm-popover-title">发现同名${categoryLabel}</strong>
      <div class="confirm-popover-message"></div>
      <label class="import-conflict-label" for="importConflictName">重命名为</label>
      <input class="import-conflict-input" id="importConflictName" type="text" maxlength="80" />
      <div class="import-conflict-error" aria-live="polite"></div>
      <div class="confirm-popover-actions import-conflict-actions">
        <button type="button" class="import-conflict-overwrite">覆盖</button>
        <button type="button" class="import-conflict-rename">重命名</button>
        <button type="button" class="import-conflict-skip">跳过</button>
      </div>`
    popover.querySelector('.confirm-popover-message').textContent = `“${name}”已存在，请选择处理方式。`
    const nameInput = popover.querySelector('.import-conflict-input')
    const errorBox = popover.querySelector('.import-conflict-error')
    nameInput.value = suggestImportedPresetName(name, usedNames)
    document.body.appendChild(popover)

    const anchorRect = anchor.getBoundingClientRect()
    const popoverRect = popover.getBoundingClientRect()
    const left = Math.min(window.innerWidth - popoverRect.width - 10, Math.max(10, anchorRect.right - popoverRect.width))
    const belowTop = anchorRect.bottom + 10
    const top = belowTop + popoverRect.height <= window.innerHeight - 10
      ? belowTop
      : Math.max(10, anchorRect.top - popoverRect.height - 10)
    popover.style.left = `${left}px`
    popover.style.top = `${top}px`

    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      document.removeEventListener('keydown', handleKeydown)
      window.removeEventListener('resize', handleResize)
      popover.remove()
      if (activeConfirmPopover?.popover === popover) activeConfirmPopover = null
      resolve(result)
    }
    const handleKeydown = (event) => {
      if (event.key === 'Escape') finish({ action: 'skip' })
      if (event.key === 'Enter' && event.target === nameInput) rename()
    }
    const handleResize = () => finish({ action: 'skip' })
    const rename = () => {
      const renamed = cleanText(nameInput.value)
      if (!renamed) {
        errorBox.textContent = '新名称不能为空'
        nameInput.focus()
        return
      }
      if (usedNames.has(renamed)) {
        errorBox.textContent = '该名称仍然存在，请换一个名称'
        nameInput.focus()
        nameInput.select()
        return
      }
      finish({ action: 'rename', name: renamed })
    }
    popover.querySelector('.import-conflict-overwrite').onclick = () => finish({ action: 'overwrite' })
    popover.querySelector('.import-conflict-rename').onclick = rename
    popover.querySelector('.import-conflict-skip').onclick = () => finish({ action: 'skip' })
    nameInput.addEventListener('input', () => { errorBox.textContent = '' })
    document.addEventListener('keydown', handleKeydown)
    window.addEventListener('resize', handleResize)
    activeConfirmPopover = { popover, close: () => finish({ action: 'skip' }) }
    nameInput.focus()
    nameInput.select()
  })
}

async function mergeImportedPresets(imported, existing, categoryLabel, anchor) {
  const merged = [...existing]
  const stats = { added: 0, overwritten: 0, renamed: 0, skipped: 0 }

  for (const item of imported) {
    const existingIndex = merged.findIndex((saved) => saved.name === item.name)
    if (existingIndex < 0) {
      merged.unshift(item)
      stats.added += 1
      continue
    }

    const usedNames = new Set(merged.map((saved) => saved.name))
    const choice = await resolvePresetImportConflict(anchor, categoryLabel, item.name, usedNames)
    if (choice.action === 'overwrite') {
      merged[existingIndex] = item
      stats.overwritten += 1
    } else if (choice.action === 'rename') {
      merged.unshift({ ...item, name: choice.name })
      stats.renamed += 1
    } else {
      stats.skipped += 1
    }
  }

  return { list: merged.slice(0, 50), stats }
}

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
function deleteSelectedSunProfile(expectedName = null) {
  const profiles = getSunProfiles()
  const index = expectedName === null
    ? Number.parseInt(document.getElementById('sunProfileSelect').value, 10)
    : profiles.findIndex((profile) => profile.name === expectedName)
  if (!Number.isInteger(index) || index < 0 || index >= profiles.length) throw new Error('请先选择预设')
  const [removed] = profiles.splice(index, 1)
  setSunProfiles(profiles)
  renderSunProfileOptions()
  document.getElementById('sunProfileName').value = ''
  setStatus(`已删除预设：${removed.name}`)
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
function deleteSelectedLightingScheme(expectedName = null) {
  const schemes = getLightingSchemes()
  const index = expectedName === null
    ? Number.parseInt(document.getElementById('lightingSchemeSelect').value, 10)
    : schemes.findIndex((scheme) => scheme.name === expectedName)
  if (!Number.isInteger(index) || index < 0 || index >= schemes.length) throw new Error('请先选择本地方案')
  const [removed] = schemes.splice(index, 1)
  setLightingSchemes(schemes)
  renderLightingSchemeOptions()
  document.getElementById('lightingSchemeName').value = ''
  setStatus(`已删除照明参数方案：${removed.name}`)
}
function exportPresetLibrary() {
  const schemes = getLightingSchemes()
  const profiles = getSunProfiles()
  downloadJsonFile('thalo-preset-library.json', {
    type: 'thalo-console-preset-library',
    version: 1,
    exportedAt: new Date().toISOString(),
    schemes,
    profiles,
  })
  setStatus(`已导出配置库：${schemes.length} 个照明方案，${profiles.length} 个日出日落预设`)
}
async function importPresetLibrary(file, anchor) {
  const payload = await readJsonFile(file)
  if (!payload || !Array.isArray(payload.schemes) || !Array.isArray(payload.profiles)) {
    throw new Error('配置库文件格式无效，文件中必须同时包含照明参数方案和日出日落预设')
  }
  const importedSchemes = normalizeImportedLightingSchemes(payload)
  const importedProfiles = normalizeImportedSunProfiles(payload)
  const schemeResult = await mergeImportedPresets(
    importedSchemes,
    getLightingSchemes(),
    '照明参数方案',
    anchor,
  )
  const profileResult = await mergeImportedPresets(
    importedProfiles,
    getSunProfiles(),
    '日出日落预设',
    anchor,
  )
  setLightingSchemes(schemeResult.list)
  setSunProfiles(profileResult.list)
  renderLightingSchemeOptions()
  renderSunProfileOptions()
  const allStats = [schemeResult.stats, profileResult.stats].reduce((total, item) => ({
    added: total.added + item.added,
    overwritten: total.overwritten + item.overwritten,
    renamed: total.renamed + item.renamed,
    skipped: total.skipped + item.skipped,
  }), { added: 0, overwritten: 0, renamed: 0, skipped: 0 })
  setStatus(
    `配置库导入完成：新增 ${allStats.added}，覆盖 ${allStats.overwritten}，重命名 ${allStats.renamed}，跳过 ${allStats.skipped}`,
  )
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
  document.getElementById('lengthInfo').textContent = `手动参数: ${state.manualHeader.length} | 总长度: ${raw.length} | 照明参数: ${payloadLen} | 分组数: ${Math.floor(payloadLen / 16)}`
  resizeRawBoxToContent()
  if (document.getElementById('currentTotalBrightness')) updateDeviceRuntimeSummary()
  scheduleQrRefresh()
}

function resizeRawBoxToContent() {
  const box = document.getElementById('rawBox')
  if (!box || box.offsetParent === null) return
  box.style.height = 'auto'
  box.style.height = `${box.scrollHeight}px`
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

function syncPanelVisibilityButtons() {
  document.getElementById('btnToggleQr')?.classList.toggle('hidden', state.qrVisible)
  document.getElementById('btnToggleRaw')?.classList.toggle('hidden', state.rawVisible)
  const deviceHidden = document.querySelector('.device-col')?.classList.contains('hidden') || false
  document.getElementById('btnToggleDevicePanel')?.classList.toggle('hidden', !deviceHidden)
}

function toggleQrPanel(visible = !state.qrVisible) {
  state.qrVisible = visible
  document.getElementById('qrPanel').classList.toggle('hidden', !state.qrVisible)
  syncPanelVisibilityButtons()
  if (state.qrVisible) generateQr()
  setStatus(state.qrVisible ? '已显示二维码区' : '已隐藏二维码区')
}

function toggleRawPanel(visible = !state.rawVisible) {
  state.rawVisible = visible
  document.getElementById('rawCard').classList.toggle('hidden', !state.rawVisible)
  syncPanelVisibilityButtons()
  if (state.rawVisible) requestAnimationFrame(resizeRawBoxToContent)
  setStatus(state.rawVisible ? '已显示原始串区' : '已隐藏原始串区')
}

function setDevicePanelVisible(visible) {
  const panelColumn = document.querySelector('.device-col')
  if (!panelColumn) return
  panelColumn.classList.toggle('hidden', !visible)
  document.getElementById('layout').classList.toggle('device-column-hidden', !visible)
  syncPanelVisibilityButtons()
  syncDeviceLogPlacement(scannedDevices)
  setStatus(visible ? '已显示灯具连接与下发' : '已隐藏灯具连接与下发')
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
  document.getElementById('btnDeleteLightingScheme').onclick = () => {
    try {
      const select = document.getElementById('lightingSchemeSelect')
      const index = Number.parseInt(select.value, 10)
      const scheme = getLightingSchemes()[index]
      if (!scheme) throw new Error('请先选择本地方案')
      openConfirmPopover(
        document.getElementById('btnDeleteLightingScheme'),
        '确认删除当前方案？',
        `“${scheme.name}”删除后无法恢复。`,
        () => deleteSelectedLightingScheme(scheme.name),
      )
    } catch (e) {
      setStatus(e.message)
    }
  }
  document.getElementById('btnImportRaw').onclick = () => {
    const raw = prompt('请粘贴完整原始串或设备报文：', cleanText(document.getElementById('rawBox').value) || `${state.manualHeader}#`)
    if (raw != null) {
      document.getElementById('rawBox').value = cleanText(raw)
      applyRawToTable()
    }
  }
  document.getElementById('qrFile').addEventListener('change', (e) => importQrImage(e.target.files[0]))
  document.getElementById('btnToggleQr').onclick = () => toggleQrPanel(true)
  document.getElementById('btnToggleRaw').onclick = () => toggleRawPanel(true)
  document.getElementById('btnToggleDevicePanel').onclick = () => setDevicePanelVisible(true)
  document.getElementById('btnHideQrCard').onclick = () => toggleQrPanel(false)
  document.getElementById('btnHideRawCard').onclick = () => toggleRawPanel(false)
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
  document.getElementById('btnExportPresetLibrary').onclick = () => {
    try {
      exportPresetLibrary()
    } catch (e) {
      setStatus(e.message)
    }
  }
  document.getElementById('presetLibraryFile').addEventListener('change', async (event) => {
    const input = event.currentTarget
    try {
      await importPresetLibrary(input.files[0], document.getElementById('presetLibraryImportLabel'))
    } catch (error) {
      closeConfirmPopover()
      setStatus(`导入失败：${error.message}`)
    } finally {
      input.value = ''
    }
  })
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
  document.getElementById('btnDeleteSunProfile').onclick = () => {
    try {
      const select = document.getElementById('sunProfileSelect')
      const index = Number.parseInt(select.value, 10)
      const profile = getSunProfiles()[index]
      if (!profile) throw new Error('请先选择预设')
      openConfirmPopover(
        document.getElementById('btnDeleteSunProfile'),
        '确认删除预设？',
        `“${profile.name}”删除后无法恢复。`,
        () => deleteSelectedSunProfile(profile.name),
      )
    } catch (e) {
      setStatus(e.message)
    }
  }
  document.getElementById('rawBox').addEventListener('input', () => {
    resizeRawBoxToContent()
    scheduleQrRefresh()
  })
  window.addEventListener('resize', () => {
    resizeRawBoxToContent()
    scheduleQrRefresh()
  })
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
  <div class="card-head"><div class="card-head-row"><div><div class="card-title">灯具连接与控制</div><div class="card-sub">局域网扫描或 AP 模式指定 IP；TCP 8266</div></div><div class="card-head-actions"><button id="btnOpenDeviceDashboard" class="card-head-button" type="button">设备状态页</button><button id="btnHideDeviceCard" class="card-hide-button" type="button">隐藏</button></div></div></div>
  <div class="card-body">
    <div class="device-connection-summary">
      <div class="device-summary-item"><span>当前连接设备名称</span><strong id="currentDeviceName">—</strong></div>
      <div class="device-summary-item device-connection-state"><span>连接状态</span><strong id="currentConnectionState" data-state="idle"><i aria-hidden="true"></i>未连接</strong></div>
      <div class="device-summary-item"><span>运行模式</span><strong id="currentDeviceMode" class="device-mode-value" data-mode="unknown">未获取</strong></div>
      <div class="device-summary-item"><span>当前总亮度</span><strong id="currentTotalBrightness" class="device-brightness-value">—</strong></div>
    </div>
    <div class="sun-grid"><label class="sun-item"><span>设备 IP</span><input id="deviceHost" class="sun-input" value="192.168.4.1" inputmode="decimal" /></label><label class="sun-item"><span>扫描网段（可选）</span><input id="deviceSubnet" class="sun-input" placeholder="例如 192.168.1" inputmode="decimal" /></label></div>
    <div class="device-group-controls">
      <label class="sun-item"><span>分组筛选</span><select id="deviceGroupFilter" class="sun-input"></select></label>
      <div class="device-group-assignment">
        <label class="sun-item"><span>当前设备分组</span><select id="currentDeviceGroup" class="sun-input"></select></label>
        <button id="btnAddDeviceGroup" type="button">新建分组</button>
      </div>
    </div>
    <div class="toolbar-grid"><button id="btnDeviceScan">扫描局域网</button><button id="btnClearDeviceCache" title="清除本机保存的灯具名称缓存">清理缓存设备</button><button id="btnDeviceRead">读取配置</button><button id="btnDevicePush">发送当前配置</button><button id="btnSendManual">发送当前亮度</button><button id="btnDeviceSync">同步时间</button><button id="btnModeToggle">切换手动模式</button><button id="btnDemoToggle">开启演示模式</button></div>
    <div class="device-list-head"><i aria-hidden="true"></i><span>可连接灯具 · <strong id="deviceListCount">0 台</strong></span><i aria-hidden="true"></i></div>
    <div id="deviceList" class="muted"></div><div id="devicePagination" class="device-pagination"></div>
    <div id="deviceLogHome"><div id="deviceLogSection" class="device-log-section"><div class="device-log-head"><span>报文日志</span><span><button id="btnExportDeviceLog" type="button">导出</button><button id="btnClearDeviceLog" type="button">清空</button></span></div><pre id="deviceLog" class="device-log">等待设备通信…</pre><div id="deviceLiveStatusHome"></div></div></div>
  </div>`
const deviceColumn = document.createElement('div')
deviceColumn.className = 'device-col'
deviceColumn.append(devicePanel)
document.querySelector('.layout').insertBefore(deviceColumn, document.getElementById('deviceLogColumn'))
document.getElementById('btnHideDeviceCard').onclick = () => setDevicePanelVisible(false)
syncPanelVisibilityButtons()

const deviceDashboard = document.createElement('div')
deviceDashboard.className = 'device-dashboard hidden'
deviceDashboard.setAttribute('role', 'dialog')
deviceDashboard.setAttribute('aria-modal', 'true')
deviceDashboard.setAttribute('aria-labelledby', 'deviceDashboardTitle')
deviceDashboard.innerHTML = `
  <div class="device-dashboard-shell">
    <div class="device-dashboard-head">
      <div>
        <h2 id="deviceDashboardTitle">多设备状态</h2>
        <p id="deviceDashboardSummary">并发读取设备状态和照明曲线</p>
      </div>
      <div class="device-dashboard-actions">
        <button id="btnRefreshDeviceDashboard" type="button">立即刷新</button>
        <button id="btnCloseDeviceDashboard" type="button">关闭</button>
      </div>
    </div>
    <div class="device-dashboard-grid" id="deviceDashboardGrid"></div>
  </div>`
document.querySelector('.app').append(deviceDashboard)

const clusterControlModal = document.createElement('div')
clusterControlModal.className = 'cluster-control-modal hidden'
clusterControlModal.setAttribute('role', 'dialog')
clusterControlModal.setAttribute('aria-modal', 'true')
clusterControlModal.setAttribute('aria-labelledby', 'clusterControlTitle')
clusterControlModal.innerHTML = `
  <div class="cluster-control-shell">
    <div class="cluster-control-head">
      <div>
        <h2 id="clusterControlTitle">集群群发配置</h2>
        <p>把编辑器中的当前完整配置并发下发到选定设备。</p>
      </div>
      <button id="btnCloseClusterControl" type="button">关闭</button>
    </div>
    <div class="cluster-control-body">
      <div class="cluster-control-settings">
        <label class="sun-item">
          <span>发送范围</span>
          <select id="clusterTargetScope" class="sun-input"></select>
        </label>
        <div class="cluster-config-summary">
          <span>发送内容</span>
          <strong id="clusterConfigName">当前编辑器配置</strong>
        </div>
      </div>
      <div class="cluster-target-head">
        <strong id="clusterTargetCount">目标设备 · 0 台</strong>
        <span>仅包含已缓存设备名称的灯具</span>
      </div>
      <div class="cluster-target-list" id="clusterTargetList"></div>
    </div>
    <div class="cluster-control-footer">
      <div class="cluster-progress-area">
        <div class="cluster-progress-track"><i id="clusterProgressBar"></i></div>
        <span id="clusterProgressText">选择发送范围后开始群发</span>
      </div>
      <div class="cluster-control-actions">
        <button id="btnCancelClusterControl" type="button">取消</button>
        <button id="btnSendClusterConfig" class="cluster-send-button" type="button">发送当前配置</button>
      </div>
    </div>
  </div>`
document.querySelector('.app').append(clusterControlModal)

const deviceStatus = document.getElementById('deviceStatus')
const deviceHost = document.getElementById('deviceHost')
const deviceSubnet = document.getElementById('deviceSubnet')
const currentDeviceName = document.getElementById('currentDeviceName')
const currentConnectionState = document.getElementById('currentConnectionState')
const currentDeviceMode = document.getElementById('currentDeviceMode')
const currentTotalBrightness = document.getElementById('currentTotalBrightness')
const deviceGroupFilter = document.getElementById('deviceGroupFilter')
const currentDeviceGroup = document.getElementById('currentDeviceGroup')
const deviceList = document.getElementById('deviceList')
const deviceListCount = document.getElementById('deviceListCount')
const deviceButtons = new Map()
const devicePagination = document.getElementById('devicePagination')
const deviceLog = document.getElementById('deviceLog')
const deviceLogHome = document.getElementById('deviceLogHome')
const deviceLogSection = document.getElementById('deviceLogSection')
const deviceLogColumn = document.getElementById('deviceLogColumn')
const deviceLogFloatingBody = document.getElementById('deviceLogFloatingBody')
const deviceDashboardGrid = document.getElementById('deviceDashboardGrid')
const deviceDashboardSummary = document.getElementById('deviceDashboardSummary')
const clusterTargetScope = document.getElementById('clusterTargetScope')
const clusterTargetList = document.getElementById('clusterTargetList')
const clusterTargetCount = document.getElementById('clusterTargetCount')
const clusterProgressBar = document.getElementById('clusterProgressBar')
const clusterProgressText = document.getElementById('clusterProgressText')
const clusterSendButton = document.getElementById('btnSendClusterConfig')
const DEVICE_PAGE_MAX_ITEMS = 60
const DEVICE_PAGE_MAX_ROWS = 30
const DEVICE_NATURAL_LAYOUT_MAX_ROWS = 8
const MAX_DEVICE_LOGS = 200
const DEVICE_EMBEDDED_LOG_MIN_HEIGHT = 200
const DEVICE_LIST_ROW_GAP = 5
const DEVICE_LIST_ROW_PITCH = 45
let scannedDevices = []
let devicePage = 0
let packetLogs = []
let connectedHost = ''
let deviceLayoutFrame = 0
let deviceIpFitFrame = 0
let deviceLogFitFrame = 0
let devicePageRowCapacity = null
let deviceLogForcedBySpace = false
const deviceRuntimeStates = new Map()
const deviceConnectionFailures = new Map()
const deviceDashboardStates = new Map()
let monitoredDeviceHosts = []
let deviceDashboardTimer = null
let deviceDashboardRefreshing = false
const DEVICE_NAME_STORAGE_KEY = 'thalo-console-device-names-v1'
const DEVICE_GROUP_STORAGE_KEY = 'thalo-console-device-groups-by-name-v2'
const LEGACY_DEVICE_GROUP_STORAGE_KEY = 'thalo-console-device-groups-v1'
const DEVICE_STATUS_HOSTS_STORAGE_KEY = 'thalo-console-status-hosts-v1'
const DEVICE_RUNTIME_STORAGE_KEY = 'thalo-console-device-runtime-v1'
const deviceNames = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(DEVICE_NAME_STORAGE_KEY) || '{}')
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}
  } catch { return {} }
})()
const deviceGroups = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(DEVICE_GROUP_STORAGE_KEY) || '{}')
    const groups = saved && typeof saved === 'object' && !Array.isArray(saved)
      ? Object.fromEntries(Object.entries(saved).filter(([name, group]) => cleanText(name) && cleanText(group)))
      : {}
    const legacy = JSON.parse(localStorage.getItem(LEGACY_DEVICE_GROUP_STORAGE_KEY) || '{}')
    if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
      Object.entries(legacy).forEach(([host, group]) => {
        const name = cleanText(deviceNames[host])
        const normalizedGroup = cleanText(group)
        if (!name || !normalizedGroup) return
        if (!groups[name]) groups[name] = normalizedGroup
        delete legacy[host]
      })
      if (Object.keys(legacy).length) localStorage.setItem(LEGACY_DEVICE_GROUP_STORAGE_KEY, JSON.stringify(legacy))
      else localStorage.removeItem(LEGACY_DEVICE_GROUP_STORAGE_KEY)
    }
    localStorage.setItem(DEVICE_GROUP_STORAGE_KEY, JSON.stringify(groups))
    return groups
  } catch { return {} }
})()
const savedDeviceGroupNames = () => [...new Set(Object.values(deviceGroups).map(cleanText).filter(Boolean))]
  .sort((left, right) => left.localeCompare(right, 'zh-CN'))
const saveDeviceGroups = () => {
  localStorage.setItem(DEVICE_GROUP_STORAGE_KEY, JSON.stringify(deviceGroups))
}
const deviceNameForHost = (host, name = null) => cleanText(name ?? scannedDevices.find((device) => device.host === host)?.name ?? deviceNames[host] ?? '')
const deviceGroupForHost = (host, name = null) => {
  const resolvedName = deviceNameForHost(host, name)
  return resolvedName ? deviceGroups[resolvedName] || '' : ''
}
const rememberDeviceStatusHost = (host, name) => {
  const resolvedHost = cleanText(host)
  const resolvedName = cleanText(name)
  if (!resolvedHost || !resolvedName) return
  let saved = []
  try {
    const parsed = JSON.parse(localStorage.getItem(DEVICE_STATUS_HOSTS_STORAGE_KEY) || '[]')
    if (Array.isArray(parsed)) saved = parsed
  } catch { /* 用当前设备重新建立状态页清单 */ }
  const byHost = new Map(saved
    .filter((item) => cleanText(item?.name) !== resolvedName || cleanText(item?.host) === resolvedHost)
    .map((item) => [cleanText(item?.host), item])
    .filter(([savedHost]) => savedHost))
  byHost.set(resolvedHost, { host: resolvedHost, name: resolvedName })
  localStorage.setItem(DEVICE_STATUS_HOSTS_STORAGE_KEY, JSON.stringify([...byHost.values()]))
}
const forgetDeviceStatusHost = (host) => {
  try {
    const saved = JSON.parse(localStorage.getItem(DEVICE_STATUS_HOSTS_STORAGE_KEY) || '[]')
    if (!Array.isArray(saved)) return
    const remaining = saved.filter((item) => cleanText(item?.host) !== host)
    if (remaining.length) localStorage.setItem(DEVICE_STATUS_HOSTS_STORAGE_KEY, JSON.stringify(remaining))
    else localStorage.removeItem(DEVICE_STATUS_HOSTS_STORAGE_KEY)
  } catch { /* 状态页清单损坏时不影响名称缓存清理 */ }
}
const persistDeviceRuntimeState = (host, runtime) => {
  let saved = {}
  try {
    const parsed = JSON.parse(localStorage.getItem(DEVICE_RUNTIME_STORAGE_KEY) || '{}')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) saved = parsed
  } catch { /* 重新建立运行状态缓存 */ }
  saved[host] = { mode: runtime.mode, demoStartedAt: runtime.demoStartedAt }
  localStorage.setItem(DEVICE_RUNTIME_STORAGE_KEY, JSON.stringify(saved))
}
const refreshDeviceGroupOptions = () => {
  const groups = savedDeviceGroupNames()
  const selectedFilter = deviceGroupFilter.value || 'all'
  const filterOptions = [
    new Option('全部设备', 'all'),
    new Option('未分组', 'ungrouped'),
    ...groups.map((group) => new Option(group, `group:${group}`)),
  ]
  deviceGroupFilter.replaceChildren(...filterOptions)
  deviceGroupFilter.value = filterOptions.some((option) => option.value === selectedFilter) ? selectedFilter : 'all'

  const currentName = deviceNameForHost(currentHost())
  const assignedGroup = currentName ? deviceGroups[currentName] || '' : ''
  currentDeviceGroup.replaceChildren(
    new Option(currentName ? '未分组' : '请先读取设备名称', ''),
    ...groups.map((group) => new Option(group, group)),
  )
  currentDeviceGroup.value = assignedGroup
  currentDeviceGroup.disabled = !currentName
  const addButton = document.getElementById('btnAddDeviceGroup')
  addButton.disabled = !currentName
  addButton.title = currentName ? `为“${currentName}”新建分组` : '请先读取设备配置以获取名称'
}
const assignCurrentDeviceGroup = (groupName) => {
  const host = currentHost()
  if (!host) throw new Error('请先选择或填写设备 IP')
  const name = deviceNameForHost(host)
  if (!name) throw new Error('请先读取设备配置，获取设备名称后再分组')
  const group = cleanText(groupName)
  if (group) deviceGroups[name] = group
  else delete deviceGroups[name]
  saveDeviceGroups()
  refreshDeviceGroupOptions()
  devicePage = 0
  devicePageRowCapacity = null
  renderDeviceList()
  updateClusterEntrySummary()
  showDeviceStatus(group ? `已将“${name}”分到“${group}”` : `已将“${name}”设为未分组`)
}
const openDeviceGroupCreator = (anchor) => {
  closeConfirmPopover()
  const popover = document.createElement('div')
  popover.className = 'confirm-popover device-group-popover'
  popover.setAttribute('role', 'dialog')
  popover.innerHTML = `
    <strong class="confirm-popover-title">新建并分配设备分组</strong>
    <div class="confirm-popover-message">新分组将按设备名称保存，并直接分配给当前设备。</div>
    <input class="device-group-name-input" type="text" maxlength="30" placeholder="例如 客厅、主缸、补光灯" />
    <div class="device-group-name-error" aria-live="polite"></div>
    <div class="confirm-popover-actions">
      <button type="button" class="device-group-cancel">取消</button>
      <button type="button" class="device-group-save">新建并分配</button>
    </div>`
  document.body.appendChild(popover)

  const input = popover.querySelector('.device-group-name-input')
  const errorBox = popover.querySelector('.device-group-name-error')
  const anchorRect = anchor.getBoundingClientRect()
  const popoverRect = popover.getBoundingClientRect()
  popover.style.left = `${Math.min(window.innerWidth - popoverRect.width - 10, Math.max(10, anchorRect.right - popoverRect.width))}px`
  const belowTop = anchorRect.bottom + 10
  popover.style.top = `${belowTop + popoverRect.height <= window.innerHeight - 10 ? belowTop : Math.max(10, anchorRect.top - popoverRect.height - 10)}px`

  const close = () => {
    document.removeEventListener('pointerdown', handleOutside, true)
    document.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('resize', close)
    window.removeEventListener('scroll', close, true)
    popover.remove()
    if (activeConfirmPopover?.popover === popover) activeConfirmPopover = null
  }
  const save = () => {
    const group = cleanText(input.value)
    if (!group) {
      errorBox.textContent = '分组名称不能为空'
      input.focus()
      return
    }
    try {
      assignCurrentDeviceGroup(group)
      close()
    } catch (error) {
      errorBox.textContent = error.message
      input.focus()
    }
  }
  const handleOutside = (event) => {
    if (!popover.contains(event.target) && event.target !== anchor) close()
  }
  const handleKeydown = (event) => {
    if (event.key === 'Escape') close()
    if (event.key === 'Enter' && event.target === input) save()
  }
  popover.querySelector('.device-group-cancel').onclick = close
  popover.querySelector('.device-group-save').onclick = save
  input.addEventListener('input', () => { errorBox.textContent = '' })
  document.addEventListener('pointerdown', handleOutside, true)
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', close)
  window.addEventListener('scroll', close, true)
  activeConfirmPopover = { popover, close }
  input.focus()
}
const deviceLabel = (host, name) => {
  const resolvedName = name ?? deviceNames[host]
  const group = resolvedName ? deviceGroups[resolvedName] : ''
  return [host, resolvedName, group ? `分组：${group}` : ''].filter(Boolean).join(' · ')
}
const cacheDeviceName = (host, name) => {
  if (!name || deviceNames[host] === name) return
  const previousName = cleanText(deviceNames[host])
  let groupChanged = false
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_DEVICE_GROUP_STORAGE_KEY) || '{}')
    const legacyGroup = cleanText(legacy?.[host])
    if (legacyGroup && !deviceGroups[name]) {
      deviceGroups[name] = legacyGroup
      groupChanged = true
    }
    if (legacy && typeof legacy === 'object' && !Array.isArray(legacy) && Object.hasOwn(legacy, host)) {
      delete legacy[host]
      if (Object.keys(legacy).length) localStorage.setItem(LEGACY_DEVICE_GROUP_STORAGE_KEY, JSON.stringify(legacy))
      else localStorage.removeItem(LEGACY_DEVICE_GROUP_STORAGE_KEY)
    }
  } catch { /* 旧版分组损坏时不影响设备名称缓存 */ }
  if (previousName && deviceGroups[previousName] && !deviceGroups[name]) {
    deviceGroups[name] = deviceGroups[previousName]
    const previousNameStillUsed = Object.entries(deviceNames)
      .some(([savedHost, savedName]) => savedHost !== host && savedName === previousName)
    if (!previousNameStillUsed) delete deviceGroups[previousName]
    groupChanged = true
  }
  if (groupChanged) saveDeviceGroups()
  deviceNames[host] = name
  localStorage.setItem(DEVICE_NAME_STORAGE_KEY, JSON.stringify(deviceNames))
  rememberDeviceStatusHost(host, name)
  updateClusterEntrySummary()
}
const recordDeviceConnectionFailure = (host) => {
  const failureCount = (deviceConnectionFailures.get(host) || 0) + 1
  if (failureCount < 2) {
    deviceConnectionFailures.set(host, failureCount)
    return ''
  }

  deviceConnectionFailures.delete(host)
  const removedName = cleanText(deviceNames[host])
  if (!removedName) return ''
  delete deviceNames[host]
  if (Object.keys(deviceNames).length) localStorage.setItem(DEVICE_NAME_STORAGE_KEY, JSON.stringify(deviceNames))
  else localStorage.removeItem(DEVICE_NAME_STORAGE_KEY)
  scannedDevices = scannedDevices.map((device) => (
    device.host === host ? { ...device, name: null } : device
  ))
  forgetDeviceStatusHost(host)
  updateClusterEntrySummary()
  return removedName
}
const currentDeviceCachedName = () => {
  const host = currentHost()
  return scannedDevices.find((device) => device.host === host)?.name ?? deviceNames[host] ?? ''
}
const runtimeStateForHost = (host = currentHost()) => {
  if (!deviceRuntimeStates.has(host)) {
    deviceRuntimeStates.set(host, { mode: 'unknown', demoStartedAt: null })
  }
  return deviceRuntimeStates.get(host)
}
const curveBrightnessAtMinute = (minute) => {
  if (!state.rows.length) return null
  const points = state.rows.map((row, index) => ({
    minute: index * 60 + clamp(row.minuteInput?.value ?? row.values['分钟'], 0, 59),
    values: LIGHT_FIELDS.map((field) => Number(row.values[field] || 0)),
  }))
  const target = ((minute % 1440) + 1440) % 1440
  let previous
  let next
  const nextIndex = points.findIndex((point) => point.minute >= target)
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
  const span = Math.max(1, next.minute - previous.minute)
  const ratio = Math.max(0, Math.min(1, (target - previous.minute) / span))
  return previous.values.map((value, index) => value + (next.values[index] - value) * ratio)
}
const formatRuntimeMinute = (minute) => {
  const normalized = Math.floor(((minute % 1440) + 1440) % 1440)
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`
}
const syncDeviceModeButtons = () => {
  const runtime = runtimeStateForHost()
  const modeButton = document.getElementById('btnModeToggle')
  const demoButton = document.getElementById('btnDemoToggle')
  if (!modeButton || !demoButton) return

  const demoActive = runtime.mode === 'demo'
  const targetMode = runtime.mode === 'manual' ? 'automatic' : 'manual'
  modeButton.dataset.targetMode = targetMode
  modeButton.textContent = targetMode === 'automatic' ? '切换自动模式' : '切换手动模式'
  modeButton.disabled = demoActive
  modeButton.title = demoActive ? '请先关闭演示模式' : ''

  demoButton.dataset.demoAction = demoActive ? 'stop' : 'start'
  demoButton.textContent = demoActive ? '关闭演示模式' : '开启演示模式'
}
function updateDeviceRuntimeSummary() {
  if (!currentDeviceMode || !currentTotalBrightness) return
  const runtime = runtimeStateForHost()
  const modeLabels = { unknown: '未获取', automatic: '自动模式', manual: '手动模式', demo: '演示模式' }
  if (runtime.mode === 'demo' && Date.now() - (runtime.demoStartedAt || Date.now()) >= 240000) {
    runtime.mode = 'automatic'
    runtime.demoStartedAt = null
    persistDeviceRuntimeState(currentHost(), runtime)
  }
  const demoMinute = runtime.mode === 'demo'
    ? Math.min(1439.999, ((Date.now() - (runtime.demoStartedAt || Date.now())) / 240000) * 1440)
    : null
  currentDeviceMode.dataset.mode = runtime.mode
  currentDeviceMode.textContent = runtime.mode === 'demo'
    ? `演示模式（${formatRuntimeMinute(demoMinute)}）`
    : (modeLabels[runtime.mode] || '未获取')
  syncDeviceModeButtons()
  if (runtime.mode === 'unknown') {
    currentTotalBrightness.textContent = '—'
    currentTotalBrightness.removeAttribute('title')
    return
  }

  let values
  let calculationLabel
  if (runtime.mode === 'manual') {
    values = LIGHT_FIELDS.map((field) => clamp(state.headerInputs[field]?.value ?? 0, 0, 100))
    calculationLabel = '手动模式六通道'
  } else {
    const now = new Date()
    const curveMinute = runtime.mode === 'demo'
      ? demoMinute
      : now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
    values = curveBrightnessAtMinute(curveMinute)
    calculationLabel = `${runtime.mode === 'demo' ? '演示曲线' : '自动曲线'} ${formatRuntimeMinute(curveMinute)}`
  }
  if (!values?.length) {
    currentTotalBrightness.textContent = '—'
    return
  }
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  const rounded = Math.round(average * 10) / 10
  currentTotalBrightness.textContent = `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`
  currentTotalBrightness.title = `${calculationLabel}：${LIGHT_FIELDS.map((field, index) => `${field} ${Math.round(values[index] * 10) / 10}%`).join('、')}`
}
const setDeviceMode = (host, mode) => {
  const runtime = runtimeStateForHost(host)
  if (mode === 'demo') {
    runtime.demoStartedAt = Date.now()
  } else {
    runtime.demoStartedAt = null
  }
  runtime.mode = mode
  persistDeviceRuntimeState(host, runtime)
  updateDeviceRuntimeSummary()
}
const stopDeviceDemoMode = (host) => {
  const runtime = runtimeStateForHost(host)
  runtime.mode = 'automatic'
  runtime.demoStartedAt = null
  persistDeviceRuntimeState(host, runtime)
  updateDeviceRuntimeSummary()
}
const updateCurrentDeviceSummary = (state = undefined) => {
  const host = currentHost()
  currentDeviceName.textContent = currentDeviceCachedName() || '—'
  const resolvedState = state ?? (host && host === connectedHost ? 'connected' : 'idle')
  const labels = { idle: '未连接', connecting: '连接中', connected: '已连接', failed: '连接失败' }
  currentConnectionState.dataset.state = resolvedState
  currentConnectionState.lastChild.textContent = labels[resolvedState]
  refreshDeviceGroupOptions()
  updateDeviceRuntimeSummary()
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
    if (!cleanText(result.response)) {
      addPacketLog('←', host, '(无返回数据)')
      throw new Error('设备未返回数据，不能判定为已连接')
    }
    deviceConnectionFailures.delete(host)
    connectedHost = host
    updateCurrentDeviceSummary('connected')
    addPacketLog('←', host, result.response)
    showDeviceStatus(`${label}完成，收到 ${result.response}`)
    return result
  } catch (error) {
    const removedName = recordDeviceConnectionFailure(host)
    if (removedName) error = new Error(`${error.message}；连续连接失败 2 次，已移除名称缓存“${removedName}”`)
    if (connectedHost === host) connectedHost = ''
    updateCurrentDeviceSummary('failed')
    if (removedName) renderDeviceList()
    addPacketLog('×', host, error.message)
    throw error
  }
}
const dashboardModeLabel = (mode) => ({
  automatic: '自动模式',
  manual: '手动模式',
  demo: '演示模式',
  unknown: '未获取',
}[mode] || '未获取')
const dashboardTimestamp = () => new Date().toLocaleTimeString('zh-CN', { hour12: false })
const dashboardCurveValues = (groups, minute) => {
  if (!groups?.length) return []
  const points = groups.map((group) => ({ minute: group[0] * 60 + group[1], values: group.slice(2, 8) }))
  const target = ((minute % 1440) + 1440) % 1440
  let previous
  let next
  const nextIndex = points.findIndex((point) => point.minute >= target)
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
const parseDashboardDevicePacket = (host, response) => {
  const packet = parseDevicePacket(response)
  const groups = chunk16(packet.payload).map(parseGroup)
  const name = readDeviceName(response) || deviceNameForHost(host) || host
  const reportedMode = readDeviceMode(response) || 'unknown'
  const runtime = runtimeStateForHost(host)
  const demoElapsed = Date.now() - (runtime.demoStartedAt || Date.now())
  if (runtime.mode === 'demo' && demoElapsed >= 240000) {
    runtime.mode = 'automatic'
    runtime.demoStartedAt = null
  }
  const mode = runtime.mode === 'demo' ? 'demo' : reportedMode
  if (mode !== 'demo' && reportedMode !== 'unknown') {
    runtime.mode = reportedMode
    runtime.demoStartedAt = null
  }
  const now = new Date()
  const targetMinute = mode === 'demo'
    ? Math.min(1439.999, (demoElapsed / 240000) * 1440)
    : now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
  const values = mode === 'manual'
    ? LIGHT_FIELDS.map((_, index) => parseHexByte(packet.header.slice(index * 2, index * 2 + 2)))
    : dashboardCurveValues(groups, targetMinute)
  const brightness = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
  return { name, mode, groups, brightness }
}
const drawDashboardCurve = (canvas, groups) => {
  if (!canvas || !groups?.length) return
  const width = Math.max(220, Math.round(canvas.clientWidth || 300))
  const height = Math.max(90, Math.round(canvas.clientHeight || 100))
  const dpr = Math.max(1, window.devicePixelRatio || 1)
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.strokeStyle = '#e8eef6'
  ctx.lineWidth = 1
  ;[0, 0.5, 1].forEach((ratio) => {
    const y = 8 + ratio * (height - 16)
    ctx.beginPath()
    ctx.moveTo(8, y)
    ctx.lineTo(width - 8, y)
    ctx.stroke()
  })
  const channelColors = LIGHT_FIELDS.map((field) => COLORS[field][1])
  channelColors.forEach((color, channelIndex) => {
    ctx.beginPath()
    groups.forEach((group, index) => {
      const minute = group[0] * 60 + group[1]
      const x = 8 + (minute / 1439) * (width - 16)
      const y = height - 8 - (group[channelIndex + 2] / 100) * (height - 16)
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.stroke()
  })
}
const collectDashboardDevices = () => {
  const byHost = new Map()
  scannedDevices.forEach((device) => {
    const name = deviceNameForHost(device.host, device.name)
    if (name) byHost.set(device.host, { host: device.host, name })
  })
  const host = currentHost()
  const currentName = deviceNameForHost(host)
  if (host && currentName) byHost.set(host, { host, name: currentName })
  return [...byHost.values()].sort((left, right) => {
    const leftGroup = deviceGroupForHost(left.host, left.name)
    const rightGroup = deviceGroupForHost(right.host, right.name)
    return leftGroup.localeCompare(rightGroup, 'zh-CN') || left.name.localeCompare(right.name, 'zh-CN')
  })
}
const renderDeviceDashboard = () => {
  const states = monitoredDeviceHosts.map((host) => deviceDashboardStates.get(host) || { host, status: 'waiting' })
  const connectedCount = states.filter((item) => item.status === 'connected' || item.status === 'warning').length
  const refreshingCount = states.filter((item) => item.status === 'connecting').length
  deviceDashboardSummary.textContent = states.length
    ? `监控 ${states.length} 台 · 已连接 ${connectedCount} 台${refreshingCount ? ` · 正在刷新 ${refreshingCount} 台` : ''} · 每分钟自动刷新`
    : '暂无已命名设备，请先扫描并读取灯具配置'

  if (!states.length) {
    const empty = document.createElement('div')
    empty.className = 'device-dashboard-empty'
    empty.textContent = '扫描设备并读取名称后，设备会显示在这里。'
    deviceDashboardGrid.replaceChildren(empty)
    return
  }

  const cards = states.map((state) => {
    const card = document.createElement('article')
    card.className = 'device-status-card'
    card.dataset.status = state.status
    const head = document.createElement('div')
    head.className = 'device-status-card-head'
    const identity = document.createElement('div')
    const name = document.createElement('strong')
    name.textContent = state.name || deviceNameForHost(state.host) || '未命名设备'
    const ip = document.createElement('span')
    ip.textContent = state.host
    identity.append(name, ip)
    const badge = document.createElement('span')
    badge.className = 'device-status-badge'
    badge.textContent = ({ connected: '已连接', connecting: '连接中', warning: '回包异常', failed: '连接失败' })[state.status] || '等待刷新'
    head.append(identity, badge)

    const info = document.createElement('div')
    info.className = 'device-status-info'
    const entries = [
      ['设备分组', deviceGroupForHost(state.host, state.name) || '未分组'],
      ['运行模式', dashboardModeLabel(state.mode)],
      ['当前总亮度', Number.isFinite(state.brightness) ? `${Math.round(state.brightness * 10) / 10}%` : '—'],
      ['更新时间', state.updatedAt || '—'],
    ]
    entries.forEach(([label, value]) => {
      const item = document.createElement('div')
      const labelElement = document.createElement('span')
      labelElement.textContent = label
      const valueElement = document.createElement('strong')
      valueElement.textContent = value
      item.append(labelElement, valueElement)
      info.append(item)
    })

    const chartTitle = document.createElement('div')
    chartTitle.className = 'device-status-chart-title'
    chartTitle.textContent = '照明曲线'
    const canvas = document.createElement('canvas')
    canvas.className = 'device-status-curve'
    const footer = document.createElement('div')
    footer.className = 'device-status-card-footer'
    const message = document.createElement('span')
    message.textContent = state.error || '六通道 24 小时曲线'
    const selectButton = document.createElement('button')
    selectButton.type = 'button'
    selectButton.textContent = '设为当前设备'
    selectButton.onclick = () => {
      deviceHost.value = state.host
      if (state.status === 'connected' || state.status === 'warning') connectedHost = state.host
      updateCurrentDeviceSummary()
      closeDeviceDashboard()
    }
    footer.append(message, selectButton)
    card.append(head, info, chartTitle, canvas, footer)
    requestAnimationFrame(() => drawDashboardCurve(canvas, state.groups))
    return card
  })
  deviceDashboardGrid.replaceChildren(...cards)
}
const refreshDashboardDevice = async (host) => {
  const previous = deviceDashboardStates.get(host) || { host, name: deviceNameForHost(host) }
  deviceDashboardStates.set(host, { ...previous, status: 'connecting', error: '' })
  renderDeviceDashboard()
  try {
    const result = await api('/api/send', { host, command: 'AAA51008BB', timeout: 1600 })
    if (!cleanText(result.response)) throw new Error('设备未返回数据')
    deviceConnectionFailures.delete(host)
    try {
      const parsed = parseDashboardDevicePacket(host, result.response)
      if (parsed.name && parsed.name !== host) cacheDeviceName(host, parsed.name)
      deviceDashboardStates.set(host, {
        host,
        ...parsed,
        status: 'connected',
        updatedAt: dashboardTimestamp(),
        error: '',
      })
    } catch (error) {
      deviceDashboardStates.set(host, {
        ...previous,
        host,
        status: 'warning',
        updatedAt: dashboardTimestamp(),
        error: `已收到回包，但配置解析失败：${error.message}`,
      })
    }
  } catch (error) {
    const removedName = recordDeviceConnectionFailure(host)
    deviceDashboardStates.set(host, {
      ...previous,
      host,
      status: 'failed',
      updatedAt: dashboardTimestamp(),
      error: removedName ? `${error.message}；已移除名称缓存“${removedName}”` : error.message,
    })
    if (removedName) {
      renderDeviceList()
      if (host === currentHost()) updateCurrentDeviceSummary('failed')
    }
  }
  renderDeviceDashboard()
}
const refreshDeviceDashboard = async () => {
  if (deviceDashboardRefreshing || deviceDashboard.classList.contains('hidden')) return
  deviceDashboardRefreshing = true
  document.getElementById('btnRefreshDeviceDashboard').disabled = true
  const queue = [...monitoredDeviceHosts]
  await Promise.all(Array.from({ length: Math.min(6, queue.length) }, async () => {
    while (queue.length) await refreshDashboardDevice(queue.shift())
  }))
  deviceDashboardRefreshing = false
  document.getElementById('btnRefreshDeviceDashboard').disabled = false
}
function closeDeviceDashboard() {
  deviceDashboard.classList.add('hidden')
  document.body.classList.remove('device-dashboard-open')
  clearInterval(deviceDashboardTimer)
  deviceDashboardTimer = null
}
const openDeviceDashboard = () => {
  const candidates = collectDashboardDevices()
  monitoredDeviceHosts = candidates.map((device) => device.host)
  candidates.forEach((device) => {
    const previous = deviceDashboardStates.get(device.host) || {}
    deviceDashboardStates.set(device.host, {
      ...previous,
      host: device.host,
      name: device.name,
      status: previous.status || 'waiting',
    })
  })
  deviceDashboard.classList.remove('hidden')
  document.body.classList.add('device-dashboard-open')
  renderDeviceDashboard()
  refreshDeviceDashboard()
  clearInterval(deviceDashboardTimer)
  deviceDashboardTimer = setInterval(refreshDeviceDashboard, 60000)
}
document.getElementById('btnOpenDeviceDashboard').onclick = () => {
  collectDashboardDevices().forEach((device) => rememberDeviceStatusHost(device.host, device.name))
  window.open(new URL('device-status.html', document.baseURI).href, '_blank', 'noopener')
}
document.getElementById('btnRefreshDeviceDashboard').onclick = refreshDeviceDashboard
document.getElementById('btnCloseDeviceDashboard').onclick = closeDeviceDashboard
deviceDashboard.addEventListener('pointerdown', (event) => {
  if (event.target === deviceDashboard) closeDeviceDashboard()
})
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !deviceDashboard.classList.contains('hidden')) closeDeviceDashboard()
})
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
  const logIsInDeviceCard = deviceLogHome.contains(deviceLogSection)
  const fixedElements = [
    body.querySelector('.device-connection-summary'),
    body.querySelector('.sun-grid'),
    body.querySelector('.device-group-controls'),
    body.querySelector('.toolbar-grid'),
    body.querySelector('.device-list-head'),
    logIsInDeviceCard ? body.querySelector('.device-log-head') : null,
  ].filter(Boolean)
  const fixedHeight = fixedElements.reduce((total, element) => total + outerHeight(element), 0)
  const listStyle = getComputedStyle(deviceList)
  const logStyle = getComputedStyle(deviceLog)
  const reservedHeight = (logIsInDeviceCard
    ? DEVICE_EMBEDDED_LOG_MIN_HEIGHT + Number.parseFloat(logStyle.marginTop || 0) + Number.parseFloat(logStyle.marginBottom || 0)
    : 0)
    + Number.parseFloat(listStyle.marginTop || 0)
    + Number.parseFloat(listStyle.marginBottom || 0)
    + (reservePagination ? 40 : 0)
  const availableHeight = innerHeight - fixedHeight - reservedHeight
  return Math.max(1, Math.min(DEVICE_PAGE_MAX_ROWS, Math.floor((availableHeight + DEVICE_LIST_ROW_GAP) / DEVICE_LIST_ROW_PITCH)))
}
const syncDeviceLogPlacement = (devices) => {
  const hasCachedDevice = devices.some((device) => Boolean(device.name ?? deviceNames[device.host]))
  const shouldFloat = deviceLogForcedBySpace || devices.length > (hasCachedDevice ? 16 : 24)
  const isFloating = deviceLogFloatingBody.contains(deviceLogSection)
  if (shouldFloat !== isFloating) {
    (shouldFloat ? deviceLogFloatingBody : deviceLogHome).appendChild(deviceLogSection)
    devicePageRowCapacity = null
  }
  const showLogColumn = shouldFloat && !deviceColumn.classList.contains('hidden')
  deviceLogColumn.classList.toggle('hidden', !showLogColumn)
  document.getElementById('layout').classList.toggle('device-log-column-visible', showLogColumn)
}
const checkEmbeddedDeviceLogHeight = (devices) => {
  cancelAnimationFrame(deviceLogFitFrame)
  deviceLogFitFrame = requestAnimationFrame(() => {
    if (window.innerWidth <= 1500 || !deviceLogHome.contains(deviceLogSection)) return
    if (deviceLog.clientHeight >= DEVICE_EMBEDDED_LOG_MIN_HEIGHT) return
    deviceLogForcedBySpace = true
    devicePageRowCapacity = null
    renderDeviceList()
  })
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
  if (recalculateCapacity) {
    devicePageRowCapacity = null
    deviceLogForcedBySpace = false
  }
  deviceLayoutFrame = requestAnimationFrame(() => renderDeviceList())
}
function renderDeviceList() {
  deviceButtons.clear()
  const allDevices = [...scannedDevices].sort((a, b) => {
    const aNamed = Boolean(a.name ?? deviceNames[a.host])
    const bNamed = Boolean(b.name ?? deviceNames[b.host])
    return Number(bNamed) - Number(aNamed)
  })
  syncDeviceLogPlacement(allDevices)
  const filter = deviceGroupFilter.value || 'all'
  const devices = allDevices.filter((device) => {
    const group = deviceGroupForHost(device.host, device.name)
    if (filter === 'ungrouped') return !group
    if (filter.startsWith('group:')) return group === filter.slice(6)
    return true
  })
  deviceListCount.textContent = filter === 'all' ? `${devices.length} 台` : `${devices.length} / ${allDevices.length} 台`
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
    const group = deviceGroupForHost(device.host, name)
    const ip = document.createElement('span')
    ip.className = 'device-ip'
    ip.dataset.fullIp = device.host
    ip.textContent = device.host
    button.title = deviceLabel(device.host, name)
    if (name) {
      const deviceName = document.createElement('span')
      deviceName.className = 'device-name'
      deviceName.textContent = group ? `${name} · ${group}` : name
      button.classList.add('known-device')
      button.append(ip, deviceName)
    } else {
      button.classList.add('unnamed-device')
      button.append(ip)
      if (group) {
        const groupName = document.createElement('span')
        groupName.className = 'device-name device-group-name'
        groupName.textContent = group
        button.append(groupName)
      }
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
  checkEmbeddedDeviceLogHeight(allDevices)
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
let clusterSending = false
let clusterResults = new Map()
let clusterDisplayTargets = null

const clusterNamedDevices = () => {
  const byName = new Map()
  Object.entries(deviceNames).forEach(([host, name]) => {
    const resolvedHost = cleanText(host)
    const resolvedName = cleanText(name)
    if (resolvedHost && resolvedName) byName.set(resolvedName, { host: resolvedHost, name: resolvedName })
  })
  try {
    const saved = JSON.parse(localStorage.getItem(DEVICE_STATUS_HOSTS_STORAGE_KEY) || '[]')
    if (Array.isArray(saved)) {
      saved.forEach((device) => {
        const host = cleanText(device?.host)
        const name = cleanText(device?.name)
        if (host && name && deviceNames[host] === name) byName.set(name, { host, name })
      })
    }
  } catch { /* 名称缓存仍可作为集群目标 */ }
  scannedDevices.forEach((device) => {
    const host = cleanText(device.host)
    const name = deviceNameForHost(host, device.name)
    if (host && name) byName.set(name, { host, name })
  })
  return [...byName.values()]
    .map((device) => ({ ...device, group: cleanText(deviceGroups[device.name]) }))
    .sort((left, right) => (
      left.group.localeCompare(right.group, 'zh-CN')
      || left.name.localeCompare(right.name, 'zh-CN')
      || left.host.localeCompare(right.host)
    ))
}

const selectedClusterTargets = () => {
  if (clusterDisplayTargets) return clusterDisplayTargets
  const scope = clusterTargetScope.value || 'all'
  const devices = clusterNamedDevices()
  if (!scope.startsWith('group:')) return devices
  const group = scope.slice(6)
  return devices.filter((device) => device.group === group)
}

function updateClusterEntrySummary() {
  const devices = clusterNamedDevices()
  const groupCount = new Set(devices.map((device) => device.group).filter(Boolean)).size
  document.getElementById('clusterEntrySummary').textContent = devices.length
    ? `可群发 ${devices.length} 台设备${groupCount ? ` · ${groupCount} 个分组` : ' · 暂无分组'}`
    : '暂无已缓存名称的设备'
}

const refreshClusterScopeOptions = () => {
  const previous = clusterTargetScope.value || 'all'
  const groups = [...new Set(clusterNamedDevices().map((device) => device.group).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, 'zh-CN'))
  const options = [
    new Option('全部已命名设备', 'all'),
    ...groups.map((group) => new Option(`分组：${group}`, `group:${group}`)),
  ]
  clusterTargetScope.replaceChildren(...options)
  clusterTargetScope.value = options.some((option) => option.value === previous) ? previous : 'all'
}

const clusterStatusLabel = (status) => ({
  queued: '等待发送',
  sending: '发送中',
  success: '发送成功',
  failed: '发送失败',
}[status] || '等待发送')

const renderClusterTargets = () => {
  const targets = selectedClusterTargets()
  clusterTargetCount.textContent = `目标设备 · ${targets.length} 台`
  clusterSendButton.disabled = clusterSending || !targets.length
  clusterSendButton.textContent = clusterSending ? '正在群发…' : `发送当前配置（${targets.length} 台）`

  if (!targets.length) {
    const empty = document.createElement('div')
    empty.className = 'cluster-target-empty'
    empty.textContent = clusterNamedDevices().length ? '当前分组没有可发送设备' : '暂无已缓存名称的设备，请先扫描并读取设备配置'
    clusterTargetList.replaceChildren(empty)
    return
  }

  clusterTargetList.replaceChildren(...targets.map((device) => {
    const result = clusterResults.get(device.host) || { status: 'queued', message: '' }
    const item = document.createElement('div')
    item.className = 'cluster-target-item'
    item.dataset.status = result.status
    const identity = document.createElement('div')
    identity.className = 'cluster-target-identity'
    const name = document.createElement('strong')
    name.textContent = device.name
    const detail = document.createElement('span')
    detail.textContent = [device.host, device.group || '未分组'].join(' · ')
    identity.append(name, detail)
    const stateBox = document.createElement('div')
    stateBox.className = 'cluster-target-state'
    const badge = document.createElement('strong')
    badge.textContent = clusterStatusLabel(result.status)
    const message = document.createElement('span')
    message.textContent = result.message || '—'
    message.title = result.message || ''
    stateBox.append(badge, message)
    item.append(identity, stateBox)
    return item
  }))
}

const updateClusterProgress = (completed, total, succeeded, failed) => {
  const percent = total ? Math.round((completed / total) * 100) : 0
  clusterProgressBar.style.width = `${percent}%`
  clusterProgressText.textContent = completed
    ? `进度 ${completed}/${total} · 成功 ${succeeded} · 失败 ${failed}`
    : `准备向 ${total} 台设备发送当前配置`
}

const closeClusterControl = () => {
  if (clusterSending) {
    clusterProgressText.textContent = '群发正在进行，请等待全部设备完成'
    return
  }
  clusterControlModal.classList.add('hidden')
  document.body.classList.remove('cluster-control-open')
}

const openClusterControl = () => {
  clusterResults = new Map()
  clusterDisplayTargets = null
  refreshClusterScopeOptions()
  const schemeName = cleanText(document.getElementById('lightingSchemeName').value)
  document.getElementById('clusterConfigName').textContent = schemeName || '当前编辑器配置（未命名）'
  clusterProgressBar.style.width = '0%'
  clusterProgressText.textContent = '选择发送范围后开始群发'
  clusterControlModal.classList.remove('hidden')
  document.body.classList.add('cluster-control-open')
  renderClusterTargets()
}

const sendClusterConfiguration = async () => {
  if (clusterSending) return
  const targets = selectedClusterTargets()
  if (!targets.length) return

  let command
  try {
    refreshAll()
    command = allSetPacket()
  } catch (error) {
    clusterProgressText.textContent = `无法生成当前配置：${error.message}`
    return
  }

  clusterSending = true
  clusterDisplayTargets = [...targets]
  clusterResults = new Map(targets.map((device) => [device.host, { status: 'queued', message: '' }]))
  clusterTargetScope.disabled = true
  document.getElementById('btnCloseClusterControl').disabled = true
  document.getElementById('btnCancelClusterControl').disabled = true
  renderClusterTargets()
  updateClusterProgress(0, targets.length, 0, 0)

  let completed = 0
  let succeeded = 0
  let failed = 0
  const queue = [...targets]
  const worker = async () => {
    while (queue.length) {
      const device = queue.shift()
      clusterResults.set(device.host, { status: 'sending', message: '正在连接…' })
      renderClusterTargets()
      addPacketLog('→', device.host, command)
      try {
        const result = await api('/api/send', { host: device.host, command, timeout: 1800 })
        if (!cleanText(result.response)) throw new Error('设备未返回数据')
        deviceConnectionFailures.delete(device.host)
        rememberDeviceStatusHost(device.host, device.name)
        addPacketLog('←', device.host, result.response)
        clusterResults.set(device.host, { status: 'success', message: `收到 ${result.response}` })
        succeeded += 1
      } catch (error) {
        const removedName = recordDeviceConnectionFailure(device.host)
        const message = removedName
          ? `${error.message}；连续失败，已移除名称缓存“${removedName}”`
          : error.message
        addPacketLog('×', device.host, message)
        clusterResults.set(device.host, { status: 'failed', message })
        failed += 1
      }
      completed += 1
      updateClusterProgress(completed, targets.length, succeeded, failed)
      renderClusterTargets()
    }
  }

  await Promise.all(Array.from({ length: Math.min(4, targets.length) }, worker))
  clusterSending = false
  clusterTargetScope.disabled = false
  document.getElementById('btnCloseClusterControl').disabled = false
  document.getElementById('btnCancelClusterControl').disabled = false
  renderClusterTargets()
  updateClusterEntrySummary()
  renderDeviceList()
  updateCurrentDeviceSummary()
  showDeviceStatus(`集群配置发送完成：成功 ${succeeded} 台，失败 ${failed} 台`)
}

document.getElementById('btnOpenClusterControl').onclick = openClusterControl
document.getElementById('btnCloseClusterControl').onclick = closeClusterControl
document.getElementById('btnCancelClusterControl').onclick = closeClusterControl
clusterTargetScope.addEventListener('change', () => {
  clusterResults = new Map()
  clusterDisplayTargets = null
  clusterProgressBar.style.width = '0%'
  clusterProgressText.textContent = '选择发送范围后开始群发'
  renderClusterTargets()
})
clusterSendButton.onclick = sendClusterConfiguration
clusterControlModal.addEventListener('pointerdown', (event) => {
  if (event.target === clusterControlModal) closeClusterControl()
})
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !clusterControlModal.classList.contains('hidden')) closeClusterControl()
})
updateClusterEntrySummary()

const readDeviceConfiguration = async () => {
  const host = currentHost()
  const result = await sendDevice('AAA51008BB', '读取配置')
  if (!result.response?.startsWith('ABAA')) throw new Error('设备未返回 ABAA 配置报文')
  document.getElementById('rawBox').value = result.response
  applyRawToTable()
  const name = readDeviceName(result.response)
  const mode = readDeviceMode(result.response)
  if (name) {
    cacheDeviceName(host, name)
    updateDeviceButton(host, name)
  }
  if (mode) setDeviceMode(host, mode)
  showDeviceStatus(`已读取并导入灯具配置${name ? `：${name}` : ''}`)
}
document.getElementById('btnDeviceScan').onclick = async () => {
  setRightToolsDrawer(false)
  try {
    showDeviceStatus('正在扫描当前网段的 TCP 8266 设备（与 App 相同，约需数秒）…')
    const result = await api('/api/scan', { subnet: deviceSubnet.value.trim() || undefined })
    deviceSubnet.value = result.subnet
    scannedDevices = result.devices
    devicePage = 0
    deviceLogForcedBySpace = false
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
  deviceLogForcedBySpace = false
  showDeviceStatus(cachedCount ? `已清理 ${cachedCount} 台灯具的名称缓存` : '当前没有缓存设备')
  updateClusterEntrySummary()
  renderDeviceList()
  updateCurrentDeviceSummary()
}
deviceHost.addEventListener('input', () => updateCurrentDeviceSummary())
deviceGroupFilter.addEventListener('change', () => {
  devicePage = 0
  devicePageRowCapacity = null
  renderDeviceList()
})
currentDeviceGroup.addEventListener('change', () => {
  try { assignCurrentDeviceGroup(currentDeviceGroup.value) } catch (error) { showDeviceStatus(error.message) }
})
document.getElementById('btnAddDeviceGroup').onclick = () => {
  if (!deviceNameForHost(currentHost())) {
    showDeviceStatus('请先读取设备配置，获取设备名称后再分组')
    return
  }
  openDeviceGroupCreator(document.getElementById('btnAddDeviceGroup'))
}
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
document.getElementById('btnModeToggle').onclick = async () => {
  const host = currentHost()
  const targetMode = runtimeStateForHost(host).mode === 'manual' ? 'automatic' : 'manual'
  const automatic = targetMode === 'automatic'
  try {
    await sendDevice(automatic ? 'AAA5100401BB' : 'AAA5100400BB', automatic ? '切换自动模式' : '切换手动模式')
    setDeviceMode(host, targetMode)
  } catch (error) { showDeviceStatus(`${automatic ? '切换自动模式' : '切换手动模式'}失败：${error.message}`) }
}
document.getElementById('btnSendManual').onclick = async () => {
  try { refreshManualHeader(); await sendDevice(`AAA51005${state.manualHeader}BB`, '发送当前亮度') } catch (error) { showDeviceStatus(`发送当前亮度失败：${error.message}`) }
}
document.getElementById('btnDemoToggle').onclick = async () => {
  const host = currentHost()
  const stopping = runtimeStateForHost(host).mode === 'demo'
  try {
    await sendDevice(stopping ? 'AAA5100A01BB' : 'AAA5100A00BB', stopping ? '关闭演示模式' : '开启演示模式')
    if (stopping) stopDeviceDemoMode(host)
    else setDeviceMode(host, 'demo')
  } catch (error) { showDeviceStatus(`${stopping ? '关闭演示模式' : '开启演示模式'}失败：${error.message}`) }
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
setInterval(updateDeviceRuntimeSummary, 1000)

function readDeviceName(packet) {
  try {
    const hex = resolveDevicePacketHex(normalizeHexStream(packet))
    if (hex.length < 430) return null
    const bytes = hex.slice(408, 430).match(/.{2}/g).map((part) => Number.parseInt(part, 16))
    const name = new TextDecoder().decode(new Uint8Array(bytes)).replace(/[\0\s]/g, '')
    return name || null
  } catch { return null }
}
function readDeviceMode(packet) {
  try {
    const hex = resolveDevicePacketHex(normalizeHexStream(packet))
    const { groupCount } = parseDevicePacketBody(hex)
    const modeOffset = 22 + groupCount * 16
    if (hex.length < modeOffset + 2) return null
    const flag = hex.slice(modeOffset, modeOffset + 2)
    if (flag === '01') return 'automatic'
    if (flag === '00') return 'manual'
    return null
  } catch { return null }
}
