let runtimeServices = {};

export function setRuntimeServices(services) {
    runtimeServices = Object.assign({}, services || {});
    return runtimeServices;
}

export function updateRuntimeServices(partial) {
    runtimeServices = Object.assign({}, runtimeServices, partial || {});
    return runtimeServices;
}

export function getRuntimeServices() {
    return runtimeServices;
}

export function getRuntimeService(key) {
    if (!key) return undefined;
    return runtimeServices ? runtimeServices[key] : undefined;
}

export function withRuntimeServices(callback) {
    if (typeof callback !== 'function') return undefined;
    return callback(runtimeServices);
}
