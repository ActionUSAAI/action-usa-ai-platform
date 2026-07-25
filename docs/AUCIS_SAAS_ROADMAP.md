# AUCIS — Hoja de Ruta hacia SaaS Multi-Firma

**Estado:** Visión de negocio, en bandeja de espera. Registrada 2026-07-23, a partir de una conversación con Alex sobre el potencial de ofrecer AUCIS como SaaS a oficinas de abogados de inmigración en EE.UU.

**Decisión explícita de Alex:** priorizar terminar de construir y validar AUCIS con la propia práctica (clientes activos reales, ya en curso desde el 2026-07-23) antes de invertir en el trabajo de convertirlo en un producto multi-firma. Este documento existe para no perder la visión, no como plan de trabajo inmediato.

## Los cinco bloques de trabajo identificados

### 1. Multi-tenencia (el cambio de arquitectura más grande)
Hoy AUCIS asume una sola organización — el RLS filtra por rol (`admin`/`supervisor`/`agent`) y por agente asignado, pero no por firma. Para múltiples firmas clientes, se necesita: tabla `organizations`, columna `organization_id` en prácticamente todas las tablas existentes, y reescribir cada política de RLS para aislar datos entre firmas por completo.

### 2. Cumplimiento legal y responsabilidad profesional
No opcional, debe resolverse antes de vender cualquier licencia:
- Unauthorized Practice of Law (UPL) — el software asiste, no practica leyes; cada firma necesita un paso de aprobación por abogado con licencia antes de radicar cualquier documento generado.
- Protección de datos sensibles (pasaportes, SSN, información migratoria de terceros) — políticas de seguridad serias, cifrado, control de acceso, posiblemente SOC 2 a futuro.
- Seguro de responsabilidad profesional para la empresa, dado que el software influye en documentos legales de terceros.

### 3. Ampliar el alcance más allá de O-1A
El pipeline completo (intake, cartas, I-129) está validado casi exclusivamente para O-1A. Un bufete de inmigración típico maneja una cartera más amplia (H-1B, L-1, EB-2 NIW, EB-1A/B, casos familiares). Expansión incremental recomendada, empezando por EB-1A (ya identificado como el siguiente paso lógico en trabajo previo — ver pendientes generales del proyecto).

### 4. Infraestructura de negocio SaaS
- Facturación y suscripciones (Stripe, planes por firma).
- Onboarding self-service de nuevas firmas (hoy la creación de casos/usuarios es manual vía scripts/panel admin).
- Roles más granulares (socios, asociados, paralegales) más allá de admin/supervisor/agent actuales.

### 5. Go-to-market
Mercado B2B especializado — demos personalizadas, casos de éxito reales (la propia práctica de Alex como primer caso de éxito validado), probablemente boca a boca dentro del gremio de abogados de inmigración.

## Orden recomendado (no decidido formalmente, sujeto a revisión cuando se retome)

1. Terminar de validar el producto actual con clientes reales de la práctica de Alex (en curso).
2. Resolver cumplimiento legal y responsabilidad profesional (bloque 2) — investigación necesaria independientemente de cuándo se lance el SaaS.
3. Multi-tenencia (bloque 1) — trabajo técnico de mayor volumen.
4. Ampliar alcance de clasificaciones (bloque 3) — en paralelo o después, según demanda real observada.
5. Infraestructura de negocio (bloque 4) y go-to-market (bloque 5) — al final, una vez el producto esté listo para múltiples firmas.
