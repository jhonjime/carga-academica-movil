<script>
	// Librerías de interfaz empaquetadas con la app (antes venían de CDN).
	import 'bootstrap/dist/css/bootstrap.min.css';
	import 'bootstrap-icons/font/bootstrap-icons.min.css';
	import 'datatables.net-bs5/css/dataTables.bootstrap5.min.css';
	import DataTable from 'datatables.net-bs5';
	import '../app.css';

	import { onMount } from 'svelte';
	import { goto, onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { iniciarAppNativa } from '$lib/movil/plataforma.js';
	import { ui, cerrarMenu } from '$lib/movil/ui.svelte.js';

	let { children } = $props();

	// DataTable.svelte espera encontrar DataTables en window (como con el CDN).
	if (typeof window !== 'undefined') window.DataTable = DataTable;

	const RUTAS_PUBLICAS = ['/login'];
	const haySesion = () => !!sessionStorage.getItem('usuario');

	// Protección de rutas: sin sesión, cualquier pantalla lleva al login.
	$effect(() => {
		const ruta = page.url.pathname;
		if (!RUTAS_PUBLICAS.includes(ruta) && ruta !== '/' && !haySesion()) {
			goto('/login', { replaceState: true });
		}
	});

	// Al cambiar de pantalla se cierra el menú lateral.
	$effect(() => {
		page.url.pathname;
		cerrarMenu();
	});

	// Transición suave entre pantallas (efecto de app nativa).
	onNavigate((navegacion) => {
		if (!document.startViewTransition) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		if (navegacion.from?.url.pathname === navegacion.to?.url.pathname) return;

		return new Promise((resolver) => {
			document.startViewTransition(async () => {
				resolver();
				await navegacion.complete;
			});
		});
	});

	onMount(() => {
		iniciarAppNativa({
			navegar: (r) => goto(r),
			ruta: () => page.url.pathname,
			alAtras: () => {
				if (ui.menuAbierto) {
					cerrarMenu();
					return true;
				}
				return false;
			}
		});
	});
</script>

<svelte:head>
	<title>Carga Académica</title>
</svelte:head>

{@render children()}
