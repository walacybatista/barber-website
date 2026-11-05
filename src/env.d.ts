/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Admin autenticado (preenchido pelo middleware) ou `null`. */
    admin: { id: number; username: string } | null;
  }
}
