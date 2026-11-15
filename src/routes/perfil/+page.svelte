<script>
    import { onMount } from 'svelte';
    import Header from '$lib/components/Header.svelte';
    import Navbar from '$lib/components/Navbar.svelte';
    import Footer from '$lib/components/Footer.svelte';
    import BtnSugerencias from '$lib/components/btnSugerencias.svelte';
    import { peticion, usuariosApi, autenticacionApi } from '$lib/api/CargaDocenteApi.js';

    const RUTAS = {
        usuarios: '/usuarios/', roles: '/roles/', programas: '/programas-academicos/',
        asignaturas: '/asignaturas/', grupos: '/grupos/', cargas: '/carga-docente/',
        evaluaciones: '/evaluaciones/', misEvaluaciones: '/evaluaciones/mis-evaluaciones',
        preguntasEvaluacion: '/preguntas-evaluacion/', respuestas: '/respuestas/'
    };

    // Si la API guarda nombres/apellidos en un solo campo, se separan al cargar y se unen al guardar.
    const JUNTOS = {
        nombres: { campos: ['primer_nombre', 'segundo_nombre'], alias: ['nombres', 'nombre', 'first_name'] },
        apellidos: { campos: ['primer_apellido', 'segundo_apellido'], alias: ['apellidos', 'apellido', 'last_name'] }
    };

    // k: clave interna · alias: nombres posibles en la API · grupo: ver JUNTOS · col: ancho (md)
    const CAMPOS = [
        { k: 'primer_nombre', et: 'Primer nombre', alias: ['primer_nombre'], grupo: 'nombres', req: true },
        { k: 'segundo_nombre', et: 'Segundo nombre', alias: ['segundo_nombre'], grupo: 'nombres' },
        { k: 'primer_apellido', et: 'Primer apellido', alias: ['primer_apellido'], grupo: 'apellidos', req: true },
        { k: 'segundo_apellido', et: 'Segundo apellido', alias: ['segundo_apellido'], grupo: 'apellidos' },
        { k: 'correo', et: 'Correo electrónico', alias: ['correo', 'email', 'correo_electronico'], tipo: 'email', req: true, col: 12 },
        {
            k: 'tipo_documento', et: 'Tipo de documento', alias: ['tipo_documento', 'tipo_doc'], col: 5,
            opciones: [['CC', 'Cédula de ciudadanía'], ['CE', 'Cédula de extranjería'], ['TI', 'Tarjeta de identidad'], ['PASAPORTE', 'Pasaporte']]
        },
        { k: 'numero_documento', et: 'Número de documento', alias: ['numero_documento', 'documento', 'cedula', 'identificacion'], max: 30, col: 7 },
        { k: 'titulo_academico', et: 'Título académico', alias: ['titulo_academico', 'titulo', 'titulo_formacion'], max: 150, col: 12 }
    ];
    const PASSWORDS = [
        ['actual', 'Contraseña actual', 'current-password', 12],
        ['nueva', 'Nueva contraseña', 'new-password', 6],
        ['confirmar', 'Confirmar contraseña', 'new-password', 6]
    ];

    let cargando = $state(true);
    let guardando = $state(false);
    let cambiando = $state(false);
    let editando = $state(false);
    let verPassword = $state(false);
    let aviso = $state({ texto: '', tipo: 'success' });
    let datos = $state(Object.fromEntries(Object.keys(RUTAS).map((k) => [k, []])));
    let usuario = $state(null);
    let perfil = $state({});
    let guardado = $state({}); // últimos valores guardados en la API (sin cambios sin enviar)
    let claves = $state({}); // clave interna -> nombre real del campo en la API
    let juntos = $state({}); // grupo -> campo único de la API
    let pass = $state({ actual: '', nueva: '', confirmar: '' });
    let misOk = $state(false); // true si /evaluaciones/mis-evaluaciones respondió bien

    const pick = (o, ...keys) => keys.map((k) => o?.[k]).find((v) => v != null && v !== '');
    const str = (o, ...keys) => String(pick(o, ...keys) ?? '');
    const normalizar = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const lista = (d) => (Array.isArray(d) ? d : Object.values(d ?? {}).find(Array.isArray) ?? (d?.data && lista(d.data)) ?? []);
    const idDe = (u) => str(u, 'usuario_id', 'user_id', 'id_usuario', 'id');
    const correoDe = (u) => normalizar(pick(u, 'correo', 'email', 'correo_electronico'));
    const notificar = (texto, tipo = 'success') => (aviso = { texto, tipo });
    const soportado = (c) => !!claves[c.k] || !!juntos[c.grupo];
    const estaActivo = (o, vacio = false) => {
        const v = pick(o, 'estado', 'estatus', 'activo', 'is_active', 'evaluacion_activa');
        return v === undefined ? vacio : ['true', '1', 'activo', 'activa', 'si', 'abierta', 'en curso'].includes(normalizar(v));
    };

    // El login guarda usuario_correo; si no está, busca un correo en cualquier valor guardado.
    function correoSesion() {
        const propio = sessionStorage.getItem('usuario_correo');
        if (propio) return normalizar(propio);
        for (const s of [sessionStorage, localStorage])
            for (const k of Object.keys(s)) {
                const c = s.getItem(k)?.match(/[^\s"'@]+@[^\s"'@]+\.[^\s"'@]+/)?.[0];
                if (c) return normalizar(c);
            }
        return '';
    }

    // Render tarda en despertar: los GET se reintentan, pero solo si fue un problema de
    // conexión o de tiempo. Un 401/404 no se reintenta porque volvería a fallar igual.
    async function get(ruta) {
        for (let i = 1; ; i++)
            try {
                return await peticion(ruta, { raw: true, signal: AbortSignal.timeout(45000) });
            } catch (e) {
                const transitorio = e?.name === 'TimeoutError' || e?.name === 'AbortError' || /conectar/i.test(e?.message ?? '');
                if (!transitorio || i === 3) throw e;
                await new Promise((r) => setTimeout(r, 3000 * i));
            }
    }

    const usuarioId = $derived(idDe(usuario));

    const nombreMostrado = $derived(
        [perfil.primer_nombre, perfil.segundo_nombre, perfil.primer_apellido, perfil.segundo_apellido].filter(Boolean).join(' ') ||
            str(usuario, 'nombre_completo', 'nombres_completos') || 'Usuario'
    );

    const rol = $derived.by(() => {
        const directo = pick(usuario, 'nombre_rol', 'rol_nombre', 'rol', 'role');
        if (typeof directo === 'string') return directo;
        const id = str(usuario, 'rol_id', 'role_id', 'id_rol');
        const r = datos.roles.find((x) => str(x, 'rol_id', 'role_id', 'id_rol', 'id') === id);
        return str(r, 'nombre_rol', 'nombre', 'rol', 'descripcion') || 'No disponible';
    });

    const estadoCuenta = $derived(
        pick(usuario, 'activo', 'is_active', 'estado') === undefined ? 'No disponible' : estaActivo(usuario) ? 'Activo' : 'Inactivo'
    );

    const nombrePrograma = $derived.by(() => {
        const id = str(usuario, 'programa_id', 'programa_academico_id', 'id_programa');
        const p = datos.programas.find((x) => str(x, 'programa_id', 'id_programa', 'id') === id);
        return str(p, 'nombre_programa', 'nombre_programa_academico', 'programa_academico', 'nombre', 'programa') || 'Sin programa asignado';
    });

    // Asignaturas y grupos (carga-docente -> grupo -> asignatura) y avance en cada evaluación activa.
    const institucional = $derived.by(() => {
        const grupoPorId = new Map(datos.grupos.map((g) => [str(g, 'grupos_id', 'grupo_id', 'id_grupo', 'id'), g]));
        const asigPorId = new Map(datos.asignaturas.map((a) => [str(a, 'asignatura_id', 'asignaturas_id', 'id_asignatura', 'id'), a]));
        const grupos = new Set();
        const asignaturas = new Set();

        for (const c of datos.cargas) {
            if (!usuarioId || str(c, 'user_id', 'usuario_id', 'docente_id', 'id_docente') !== usuarioId) continue;
            const g = grupoPorId.get(str(c, 'id_grupo', 'grupos_id', 'grupo_id'));
            if (g) grupos.add(str(g, 'nombre_grupo', 'nombre', 'codigo', 'grupo') || 'Grupo');
            const a = asigPorId.get(str(c, 'asignatura_id', 'asignaturas_id', 'id_asignatura') || str(g, 'asignaturas_id', 'asignatura_id', 'id_asignatura'));
            if (a) asignaturas.add(str(a, 'nombres_asignaturas', 'nombre_asignatura', 'nombre') || 'Asignatura');
        }

        // Evaluaciones asignadas al usuario (si la API no respondió, se usan las activas).
        const base = misOk ? datos.misEvaluaciones : datos.evaluaciones;

        // Mis respuestas activas. Cada pregunta se cuenta una sola vez aunque esté repetida.
        const mias = datos.respuestas.filter(
            (r) => usuarioId && str(r, 'usuario_id', 'user_id', 'id_usuario') === usuarioId && estaActivo(r, true)
        );

        const evaluaciones = base.filter((e) => estaActivo(e, true)).map((e) => {
            const id = str(e, 'evaluacion_id', 'id_evaluacion', 'id');

            // Las preguntas de una evaluación están en la relación pregunta-evaluación.
            const preguntas = new Set(
                datos.preguntasEvaluacion
                    .filter((p) => str(p, 'evaluacion_id', 'id_evaluacion') === id && estaActivo(p, true))
                    .map((p) => str(p, 'pregunta_evaluacion_id'))
                    .filter(Boolean)
            );

            // Se responde por pregunta_evaluacion_id y dentro de esa misma evaluación.
            const hechas = new Set(
                mias
                    .filter((r) => str(r, 'evaluacion_id', 'id_evaluacion') === id && pick(r, 'puntaje', 'calificacion', 'valor') != null)
                    .map((r) => str(r, 'pregunta_evaluacion_id'))
                    .filter((p) => preguntas.has(p))
            );

            const total = preguntas.size;
            const completa = total > 0 && hechas.size >= total;
            const [texto, clase] = !total ? ['Sin preguntas', 'secondary'] : completa ? ['Completada', 'success'] : hechas.size ? ['En progreso', 'info'] : ['Pendiente', 'warning'];
            const titulo = str(e, 'titulo', 'nombre', 'nombre_evaluacion', 'descripcion') || `Evaluación ${id}`;
            const tipo = str(e, 'tipo_evaluacion');

            return {
                titulo: tipo ? `${titulo} — ${tipo}` : titulo,
                hechas: hechas.size,
                total,
                porcentaje: total ? Math.round((hechas.size / total) * 100) : 0,
                completa,
                texto,
                clase
            };
        });

        return { grupos: [...grupos], asignaturas: [...asignaturas], evaluaciones };
    });

    // Copia el usuario de la API al formulario, recordando el nombre real de cada campo.
    function rellenar(u) {
        const k = {}, p = {}, j = {};
        for (const c of CAMPOS) {
            k[c.k] = c.alias.find((a) => u?.[a] !== undefined);
            p[c.k] = String(u?.[k[c.k]] ?? '');
        }
        // Nombres o apellidos en un solo campo: primera palabra = primero, el resto = segundo.
        for (const [g, { campos: [a, b], alias }] of Object.entries(JUNTOS)) {
            const clave = alias.find((x) => u?.[x] !== undefined);
            if (k[a] || !clave) continue;
            const [primero = '', ...resto] = String(u[clave] ?? '').trim().split(/\s+/);
            p[a] = primero;
            p[b] = resto.join(' ');
            j[g] = clave;
        }
        claves = k;
        juntos = j;
        perfil = p;
        guardado = { ...p };
    }

    // Arma el cuerpo completo para PUT /usuarios/{id} (igual que la página de Usuarios):
    // incluye rol_id y estado actuales para que la API no los pierda ni los rechace.
    function construirPayload(valores) {
        const texto = (k) => String(valores[k] ?? '').trim();
        const payload = {};

        for (const c of CAMPOS) {
            if (c.grupo && juntos[c.grupo]) continue; // nombres y apellidos se envían unidos
            const clave = claves[c.k] ?? (texto(c.k) ? c.alias[0] : undefined);
            if (!clave) continue;
            payload[clave] = c.k === 'correo' ? texto(c.k).toLowerCase() : texto(c.k) || null;
        }
        for (const [g, { campos }] of Object.entries(JUNTOS))
            if (juntos[g]) payload[juntos[g]] = campos.map(texto).filter(Boolean).join(' ');

        const rolId = Number(pick(usuario, 'rol_id', 'role_id', 'id_rol'));
        if (Number.isFinite(rolId)) payload.rol_id = rolId;
        payload.estado = estaActivo(usuario, true);
        if (usuario?.codigo_personal !== undefined) payload.codigo_personal = usuario.codigo_personal;

        return payload;
    }

    async function cargar() {
        cargando = true;
        aviso.texto = '';
        try {
            const correo = correoSesion();
            if (!correo) throw new Error('No encontré tu sesión. Inicia sesión nuevamente.');

            const pedir = async ([k, ruta]) => (datos[k] = lista(await get(ruta)));
            const [primero, ...resto] = Object.entries(RUTAS);
            await pedir(primero); // /usuarios/ despierta el servidor; el resto va en paralelo
            const r = await Promise.allSettled(resto.map(pedir));
            misOk = r[resto.findIndex(([k]) => k === 'misEvaluaciones')]?.status === 'fulfilled';

            usuario = datos.usuarios.find((u) => correoDe(u) === correo);
            if (!usuario) throw new Error('No encontré tu usuario en la API usando el correo de la sesión.');
            rellenar(usuario);

            const fallidos = r.filter((x, i) => x.status === 'rejected' && resto[i][0] !== 'misEvaluaciones').length;
            if (fallidos) notificar(`${fallidos} consulta(s) institucionales no pudieron cargarse; la información puede estar incompleta.`, 'warning');
        } catch (e) {
            notificar(e.message || 'Ocurrió un error al cargar el perfil.', 'danger');
        } finally {
            cargando = false;
        }
    }

    async function guardar() {
        const texto = (k) => String(perfil[k] ?? '').trim();
        if (!texto('primer_nombre') || !texto('primer_apellido') || !texto('correo'))
            return notificar('Primer nombre, primer apellido y correo son obligatorios.', 'danger');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto('correo'))) return notificar('Escribe un correo electrónico válido.', 'danger');

        guardando = true;
        aviso.texto = '';
        try {
            const id = usuarioId;
            await usuariosApi.actualizar(encodeURIComponent(id), construirPayload(perfil));

            datos.usuarios = lista(await get(RUTAS.usuarios));
            const nuevo = datos.usuarios.find((u) => idDe(u) === id) ?? usuario;

            // Campos que escribiste pero que la API sigue sin devolver (no existen en el backend).
            const ignorados = CAMPOS.filter(
                (c) => !soportado(c) && texto(c.k) && ![...c.alias, ...(JUNTOS[c.grupo]?.alias ?? [])].some((a) => nuevo?.[a] !== undefined)
            ).map((c) => c.et);

            usuario = nuevo;
            rellenar(nuevo);
            // Si cambió el correo, la sesión debe seguir apuntando al mismo usuario.
            if (nuevo && correoDe(nuevo)) sessionStorage.setItem('usuario_correo', pick(nuevo, 'correo', 'email', 'correo_electronico'));
            editando = false;
            ignorados.length
                ? notificar(`Guardado, pero tu API no devuelve ni guarda: ${ignorados.join(', ')}. Agrega esas columnas al backend.`, 'warning')
                : notificar('Perfil actualizado correctamente.');
        } catch (e) {
            notificar(e.message, 'danger');
        } finally {
            guardando = false;
        }
    }

    // La API no tiene una ruta "cambiar-password": la contraseña se cambia con el mismo
    // PUT /usuarios/{id} que usa la página de Usuarios (campo "contraseña").
    // Antes se comprueba la contraseña actual iniciando sesión con ella.
    async function cambiarPassword() {
        aviso.texto = '';
        if (!pass.actual || !pass.nueva || !pass.confirmar) return notificar('Completa los tres campos de contraseña.', 'danger');
        if (pass.nueva.length < 8) return notificar('La nueva contraseña debe tener al menos 8 caracteres.', 'danger');
        if (pass.nueva !== pass.confirmar) return notificar('Las contraseñas nuevas no coinciden.', 'danger');
        if (pass.nueva === pass.actual) return notificar('La nueva contraseña debe ser distinta de la actual.', 'danger');

        cambiando = true;
        try {
            try {
                await autenticacionApi.iniciarSesion({ correo: guardado.correo || correoSesion(), password: pass.actual });
            } catch (e) {
                throw new Error(/conectar/i.test(e?.message ?? '') ? e.message : 'La contraseña actual no es correcta.');
            }

            await usuariosApi.actualizar(encodeURIComponent(usuarioId), {
                ...construirPayload(guardado),
                contraseña: pass.nueva
            });

            pass = { actual: '', nueva: '', confirmar: '' };
            verPassword = false;
            notificar('Contraseña cambiada correctamente.');
        } catch (e) {
            notificar(e.message, 'danger');
        } finally {
            cambiando = false;
        }
    }

    onMount(cargar);
</script>

<svelte:head>
    <title>Mi perfil | ACTA</title>
    <meta name="description" content="Consulta y administra tu perfil." />
</svelte:head>

{#snippet entrada(c)}
    <div class="col-12 col-md-{c.col ?? 6}">
        <label class="form-label" for={c.k}>{c.et}{c.req ? ' *' : ''}</label>
        {#if c.opciones}
            <select id={c.k} class="form-select" bind:value={perfil[c.k]} disabled={!editando}>
                <option value="">Seleccionar</option>
                {#each c.opciones as [valor, texto]}<option value={valor}>{texto}</option>{/each}
            </select>
        {:else}
            <input id={c.k} type={c.tipo ?? 'text'} class="form-control" maxlength={c.max} required={c.req} bind:value={perfil[c.k]} disabled={!editando} />
        {/if}
        
    </div>
{/snippet}

{#snippet chips(titulo, items)}
    {#if items.length}
        <h3 class="small fw-semibold mb-2">{titulo}</h3>
        <div class="d-flex flex-wrap gap-2 mb-3">
            {#each items as item}<span class="badge rounded-pill text-bg-light border text-dark p-2">{item}</span>{/each}
        </div>
    {/if}
{/snippet}

<Header />
<Navbar />

<main class="bg-light min-vh-100 py-4">
    <div class="container-xl px-3">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
            <div>
                <p class="text-primary fw-semibold small mb-1">CUENTA PERSONAL</p>
                <h1 class="h3 fw-bold mb-1">Mi perfil</h1>
                <p class="text-secondary mb-0">Administra tus datos personales.</p>
            </div>
            {#if usuario && !editando}
                <button class="btn btn-primary px-4" onclick={() => (editando = true)}>
                    <i class="bi bi-pencil-square me-2"></i>Editar perfil
                </button>
            {/if}
        </div>

        {#if aviso.texto}
            <div class="alert alert-{aviso.tipo} alert-dismissible" role="alert">
                {aviso.texto}
                <button type="button" class="btn-close" aria-label="Cerrar mensaje" onclick={() => (aviso.texto = '')}></button>
            </div>
        {/if}

        {#if cargando}
            <div class="card border-0 shadow-sm rounded-4">
                <div class="card-body py-5 text-center">
                    <div class="spinner-border text-primary mb-3" role="status"></div>
                    <p class="text-secondary mb-0">Cargando información del perfil...</p>
                </div>
            </div>
        {:else if usuario}
            {@const faltan = CAMPOS.filter((c) => !soportado(c)).map((c) => c.et)}
            <div class="row g-4">
                <aside class="col-12 col-lg-4">
                    <section class="card border-0 shadow-sm rounded-4 h-100">
                        <div class="card-body p-4 text-center">
                            <div class="avatar mx-auto mb-3"><i class="bi bi-person"></i></div>
                            <h2 class="h5 fw-bold mb-1">{nombreMostrado}</h2>
                            <p class="text-secondary small mb-3">{perfil.correo}</p>
                            <span class="badge text-bg-primary rounded-pill px-3 py-2">{rol}</span>
                            <hr class="my-4" />
                            <div class="text-start">
                                <p class="small text-secondary mb-1">Título académico</p>
                                <p class="fw-semibold mb-3">{perfil.titulo_academico || 'No registrado'}</p>
                                <p class="small text-secondary mb-1">Programa académico</p>
                                <p class="fw-semibold mb-3">{nombrePrograma}</p>
                                <p class="small text-secondary mb-1">Estado de la cuenta</p>
                                <p class="mb-0"><span class="badge text-bg-light border text-dark">{estadoCuenta}</span></p>
                            </div>
                            <p class="text-secondary small mt-4 mb-0">El rol, el programa y el estado de la cuenta solo pueden modificarse por un administrador.</p>
                        </div>
                    </section>
                </aside>

                <div class="col-12 col-lg-8">
                    <section class="card border-0 shadow-sm rounded-4 mb-4">
                        <div class="card-body p-4">
                            <h2 class="h5 fw-bold mb-1">Datos personales</h2>
                            <p class="text-secondary small mb-4">
                                Información básica de tu cuenta.
                                {#if !editando}<strong class="text-primary">Pulsa «Editar perfil» para modificarla.</strong>{/if}
                            </p>

                            <form onsubmit={(e) => { e.preventDefault(); guardar(); }}>
                                <div class="row g-3">{#each CAMPOS as c}{@render entrada(c)}{/each}</div>

                                {#if editando}
                                    {#if faltan.length}
                                        <p class="small text-warning-emphasis mt-3 mb-0">
                                            Estos campos aún no existen en tu API: {faltan.join(', ')}. Puedes escribirlos, pero solo se guardarán cuando los agregues al backend.
                                        </p>
                                    {/if}
                                    <div class="d-flex flex-wrap justify-content-end gap-2 mt-4">
                                        <button type="button" class="btn btn-light border" disabled={guardando} onclick={() => { rellenar(usuario); editando = false; }}>Cancelar</button>
                                        <button type="submit" class="btn btn-primary px-4" disabled={guardando}>
                                            {#if guardando}<span class="spinner-border spinner-border-sm me-2"></span>Guardando...{:else}Guardar cambios{/if}
                                        </button>
                                    </div>
                                {/if}
                            </form>
                        </div>
                    </section>

                    <section class="card border-0 shadow-sm rounded-4 mb-4">
                        <div class="card-body p-4">
                            <h2 class="h5 fw-bold mb-1">Asignaturas y grupos</h2>
                            <p class="text-secondary small mb-3">Información consultada desde carga docente.</p>
                            {#if !institucional.asignaturas.length && !institucional.grupos.length}
                                <p class="vacio mb-0">No se encontraron asignaturas o grupos asociados a tu cuenta.</p>
                            {:else}
                                {@render chips('Asignaturas', institucional.asignaturas)}
                                {@render chips('Grupos', institucional.grupos)}
                            {/if}
                        </div>
                    </section>

                    <section class="card border-0 shadow-sm rounded-4 mb-4">
                        <div class="card-body p-4">
                            <h2 class="h5 fw-bold mb-1">Seguimiento de evaluaciones</h2>
                            <p class="text-secondary small mb-3">Tu avance en las evaluaciones que tienes asignadas.</p>
                            {#each institucional.evaluaciones as ev}
                                <div class="d-flex justify-content-between align-items-center gap-3 py-3 border-top">
                                    <div class="flex-grow-1">
                                        <p class="fw-semibold mb-1">{ev.titulo}</p>
                                        <div class="progress" style="height: 5px">
                                            <div class="progress-bar" class:bg-success={ev.completa} style:width="{ev.porcentaje}%"></div>
                                        </div>
                                        <p class="small text-secondary mt-1 mb-0">{ev.hechas} de {ev.total} preguntas · {ev.porcentaje}%</p>
                                    </div>
                                    <span class="badge text-bg-{ev.clase}">{ev.texto}</span>
                                </div>
                            {:else}
                                <p class="vacio mb-0">{misOk ? 'No tienes evaluaciones asignadas.' : 'No hay evaluaciones activas.'}</p>
                            {/each}
                        </div>
                    </section>

                    <section class="card border-0 shadow-sm rounded-4">
                        <div class="card-body p-4">
                            <div class="d-flex flex-wrap justify-content-between align-items-center gap-3">
                                <div>
                                    <h2 class="h5 fw-bold mb-1">Seguridad de la cuenta</h2>
                                    <p class="text-secondary small mb-0">Cambia tu contraseña de forma independiente.</p>
                                </div>
                                <button class="btn btn-outline-primary" onclick={() => (verPassword = !verPassword)}>
                                    <i class="bi bi-shield-lock me-2"></i>{verPassword ? 'Cerrar formulario' : 'Cambiar contraseña'}
                                </button>
                            </div>

                            {#if verPassword}
                                <hr class="my-4" />
                                <form onsubmit={(e) => { e.preventDefault(); cambiarPassword(); }}>
                                    <div class="row g-3">
                                        {#each PASSWORDS as [k, etiqueta, auto, col]}
                                            <div class="col-12 col-md-{col}">
                                                <label class="form-label" for="pass-{k}">{etiqueta}</label>
                                                <input id="pass-{k}" type="password" class="form-control" autocomplete={auto}
                                                    minlength={k === 'actual' ? undefined : 8} required bind:value={pass[k]} />
                                            </div>
                                        {/each}
                                    </div>
                                    <div class="d-flex justify-content-end mt-4">
                                        <button type="submit" class="btn btn-primary" disabled={cambiando}>
                                            {cambiando ? 'Actualizando...' : 'Actualizar contraseña'}
                                        </button>
                                    </div>
                                </form>
                            {/if}
                        </div>
                    </section>
                </div>
            </div>
        {:else}
            <button class="btn btn-outline-primary" onclick={cargar}><i class="bi bi-arrow-clockwise me-2"></i>Reintentar</button>
        {/if}
    </div>
</main>

<Footer />
<BtnSugerencias />

<style>
    .avatar { display: grid; place-items: center; width: 92px; height: 92px; border-radius: 50%; background: #e8efff; color: #2456a6; font-size: 2.8rem; }
    .vacio { padding: 24px 16px; text-align: center; color: #718096; background: #f8fafc; border: 1px dashed #d9e1ec; border-radius: 12px; }
</style>