import type { NavItem, NavItemCondition, NavItemConditionExpr, NavItemConditionGroup, JSONRecord, JSONValue } from "../types";

type PathSegment = { key: string } | { index: number } | { wildcard: true };

function parsePath(path: string): PathSegment[] {
    const segments: PathSegment[] = [];
    const re = /([^.[]+)|\[(\d+|\*)\]/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(path)) !== null) {
        if (match[1] !== undefined) {
            segments.push({ key: match[1] });
        } else if (match[2] === '*') {
            segments.push({ wildcard: true });
        } else {
            segments.push({ index: Number(match[2]) });
        }
    }
    return segments;
}

function resolveSegments(value: JSONValue, segments: PathSegment[]): JSONValue[] {
    if (segments.length === 0) return [value];
    const [head, ...tail] = segments;

    if ('wildcard' in head) {
        if (!Array.isArray(value)) return [];
        return value.flatMap(item => resolveSegments(item, tail));
    }
    if ('index' in head) {
        if (!Array.isArray(value)) return [];
        return resolveSegments(value[head.index] ?? null, tail);
    }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return [null];
    return resolveSegments((value as JSONRecord)[head.key] ?? null, tail);
}

function compareOp(dataVal: JSONValue, op: NavItemCondition['op'], condVal: JSONValue): boolean {
    switch (op ?? '==') {
        case '==': return dataVal === condVal;
        case '!=': return dataVal !== condVal;
        case '>': return (dataVal as number) > (condVal as number);
        case '>=': return (dataVal as number) >= (condVal as number);
        case '<': return (dataVal as number) < (condVal as number);
        case '<=': return (dataVal as number) <= (condVal as number);
        case 'in': return Array.isArray(condVal) && condVal.includes(dataVal);
        case 'not_in': return Array.isArray(condVal) && !condVal.includes(dataVal);
        default: return false;
    }
}

function isLeaf(expr: NavItemConditionExpr): expr is NavItemCondition {
    return 'key' in expr;
}

function isGroup(expr: NavItemConditionExpr): expr is NavItemConditionGroup {
    return 'and' in expr || 'or' in expr;
}

function evalCondition(condition: NavItemCondition, data: JSONRecord): boolean {
    const segments = parsePath(condition.key);
    const leaves = resolveSegments(data, segments);
    return leaves.some(leaf => compareOp(leaf, condition.op, condition.value));
}

function evalExpr(expr: NavItemConditionExpr, data: JSONRecord): boolean {
    if (isLeaf(expr)) return evalCondition(expr, data);
    if (isGroup(expr)) {
        if ('and' in expr) {
            if (expr.and.length === 0) return false;
            return expr.and.every(e => evalExpr(e, data));
        }
        if (expr.or.length === 0) return false;
        return expr.or.some(e => evalExpr(e, data));
    }
    return false;
}

/** Returns true when a nav item should be hidden given the current data. */
export function isNavItemHidden(item: NavItem, data?: JSONRecord): boolean {
    if (!item.hidden_when || !data) return false;
    return isConditionExprHidden(item.hidden_when, data);
}

/** Evaluates a visibility expression against data. */
export function isConditionExprHidden(
    hiddenWhen: NavItemConditionExpr | NavItemConditionExpr[] | undefined,
    data?: JSONRecord,
): boolean {
    if (!hiddenWhen || !data) return false;
    if (Array.isArray(hiddenWhen)) {
        if (hiddenWhen.length === 0) return false;
        return hiddenWhen.every(e => evalExpr(e, data));
    }
    return evalExpr(hiddenWhen, data);
}

/** Filter nav items, removing hidden ones based on data. */
export function filterNavItems(items: NavItem[], data?: JSONRecord): NavItem[] {
    return items.filter(item => !isNavItemHidden(item, data));
}
