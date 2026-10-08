import { NextResponse } from "next/server";

// Format respons API: sukses { data, meta? }, gagal { error: { code, message, fields? } }.

export type FieldErrors = Record<string, string[]>;

export function ok<TData, TMeta = undefined>(data: TData, meta?: TMeta, status = 200) {
  return NextResponse.json(meta === undefined ? { data } : { data, meta }, { status });
}

export function fail(status: number, code: string, message: string, fields?: FieldErrors) {
  return NextResponse.json(
    { error: fields ? { code, message, fields } : { code, message } },
    { status },
  );
}
