const NAME_KEY = 'thalo-console-device-names-v1'
const INVENTORY_KEY = 'thalo-console-device-inventory-v1'
const HOSTS_KEY = 'thalo-console-status-hosts-v1'
const RUNTIME_KEY = 'thalo-console-device-runtime-v1'
const text = (value) => String(value || '').trim()

export function observedMac(value) {
  const compact = text(value).replace(/[:-]/g, '').toUpperCase()
  if (!/^[0-9A-F]{12}$/.test(compact) || /^0{12}$/.test(compact) || /^F{12}$/.test(compact)
    || (Number.parseInt(compact.slice(0, 2), 16) & 1)) return ''
  return compact.match(/.{2}/g).join(':')
}

export function findDeviceInventoryRecord(inventory, host, name = '', mac = '') {
  const actualMac = observedMac(mac)
  const exact = inventory.find((item) => text(item.lastIp) === text(host) && text(host))
  if (actualMac) {
    const matches = inventory.filter((item) => observedMac(item.mac) === actualMac)
    if (matches.length) return matches.length === 1 ? matches[0] : null
    // 旧档案首次补 MAC 只能沿用未绑定 MAC、名称没有冲突的原 IP。
    return exact && !text(exact.mac) && (!text(name) || text(exact.name) === text(name)) ? exact : null
  }
  if (exact && (!text(name) || text(exact.name) === text(name))) return exact
  const matches = inventory.filter((item) => text(item.name) === text(name) && text(name))
  // 已绑定 MAC 的档案不能再靠名称跨 IP 自动迁移。
  return matches.length === 1 && !text(matches[0].mac) ? matches[0] : null
}

export function reconcileDeviceObservations(state, observations) {
  const inventory = state.inventory.map((item) => ({ ...item }))
  const originals = state.inventory
  const names = { ...state.names }
  const affectedHosts = new Set()
  const invalidRuntimeHosts = new Set()
  const incoming = [...new Map(observations.map((item) => [text(item.host), {
    host: text(item.host), name: text(item.name), mac: observedMac(item.mac),
  }])).values()].filter((item) => item.host)
  const duplicateMacs = new Set(incoming.filter((item) => item.mac
    && incoming.some((other) => other !== item && other.mac === item.mac)).map((item) => item.mac))
  incoming.forEach((item) => { if (duplicateMacs.has(item.mac)) item.mac = '' })
  const assignments = incoming.map((observation) => ({
    observation,
    original: findDeviceInventoryRecord(originals, observation.host, observation.name, observation.mac),
  }))

  // 全批次先解除旧 IP，再填入新 IP，保证两台重名灯互换 IP 时不会覆盖彼此。
  assignments.forEach(({ observation, original }) => {
    if (!observation.mac) return
    affectedHosts.add(observation.host)
    if (original?.lastIp && original.lastIp !== observation.host) {
      affectedHosts.add(original.lastIp)
      invalidRuntimeHosts.add(original.lastIp)
      invalidRuntimeHosts.add(observation.host)
    }
    inventory.forEach((record, index) => {
      if (originals[index]?.lastIp !== observation.host || originals[index] === original) return
      record.lastIp = ''
      invalidRuntimeHosts.add(observation.host)
    })
  })
  affectedHosts.forEach((host) => { delete names[host] })
  let statusHosts = state.statusHosts.filter((item) => !affectedHosts.has(text(item?.host ?? item)))

  assignments.forEach(({ observation, original }) => {
    const { host, mac } = observation
    let record = original ? inventory[originals.indexOf(original)] : null
    if (mac) {
      if (!record && observation.name) {
        record = { sn: '', mac, name: observation.name, group: '', lastIp: host }
        inventory.push(record)
      }
      if (record) {
        record.mac = mac
        record.lastIp = host
        if (observation.name) record.name = observation.name
      }
    } else if (record && !text(record.mac) && observation.name) {
      if (record.lastIp && record.lastIp !== host) {
        delete names[record.lastIp]
        statusHosts = statusHosts.filter((item) => text(item?.host ?? item) !== record.lastIp)
        invalidRuntimeHosts.add(record.lastIp)
      }
      record.lastIp = host
    }
    const name = observation.name || (mac ? record?.name : names[host])
    if (!name) return
    names[host] = name
    statusHosts = statusHosts.filter((item) => text(item?.host ?? item) !== host)
    statusHosts.push({ host, name, sn: record?.sn || '', mac: mac || record?.mac || '' })
  })
  return { inventory, names, statusHosts, invalidRuntimeHosts: [...invalidRuntimeHosts] }
}

export function persistDeviceObservations(storage, observations) {
  const read = (key, fallback) => {
    try {
      const value = JSON.parse(storage.getItem(key))
      return Array.isArray(fallback) ? (Array.isArray(value) ? value : fallback)
        : value && typeof value === 'object' && !Array.isArray(value) ? value : fallback
    } catch { return fallback }
  }
  const result = reconcileDeviceObservations({
    inventory: read(INVENTORY_KEY, []), names: read(NAME_KEY, {}), statusHosts: read(HOSTS_KEY, []),
  }, observations)
  const runtime = read(RUNTIME_KEY, {})
  result.invalidRuntimeHosts.forEach((host) => { delete runtime[host] })
  for (const [key, value] of [[INVENTORY_KEY, result.inventory], [NAME_KEY, result.names], [HOSTS_KEY, result.statusHosts], [RUNTIME_KEY, runtime]]) {
    const serialized = JSON.stringify(value)
    if (storage.getItem(key) !== serialized) storage.setItem(key, serialized)
  }
  return result
}
