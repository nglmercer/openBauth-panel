function errorString(error: unknown | string, log = false) {
    if (log) console.log(error);
    let ErrorInstance = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'An unknown error occurred');
    return ErrorInstance.message;
}
function notResult(error: string | unknown, log = true) {
    if (log) console.log(error);
    return {
        success: false,
        error: errorString(error, log)
    }
}
export { errorString, notResult };
