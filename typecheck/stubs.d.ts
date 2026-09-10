// Loose ambient declarations so the local tree can be type-checked without
// node_modules. Third-party APIs are typed as `any`; our own modules keep
// their real types so cross-file mistakes still surface.

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
  interface IntrinsicAttributes {
    key?: string | number | null;
  }
  interface Element {}
  interface ElementClass {}
  interface ElementChildrenAttribute {
    children: {};
  }
}

declare module "react" {
  export type ReactNode = any;
  export type ReactElement = any;
  export type CSSProperties = Record<string, any>;
  export type FormEvent<T = any> = any;
  export type ChangeEvent<T = any> = any;
  export type MouseEvent<T = any> = any;
  export type PointerEvent<T = any> = any;
  export type KeyboardEvent<T = any> = any;
  export type SyntheticEvent<T = any> = any;
  export type RefObject<T> = { current: T | null };
  export type MutableRefObject<T> = { current: T };
  export type Dispatch<A> = (value: A) => void;
  export type SetStateAction<S> = S | ((prev: S) => S);
  export type ComponentProps<T> = any;
  export type PropsWithChildren<P = {}> = P & { children?: ReactNode };
  export type FC<P = {}> = (props: P) => any;
  export type ComponentType<P = {}> = any;
  export type Context<T> = { Provider: any; Consumer: any };
  export function createContext<T>(v: T): Context<T>;
  export function useContext<T>(c: Context<T>): T;
  export function useState<S>(init: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
  export function useEffect(fn: () => void | (() => void), deps?: any[]): void;
  export function useLayoutEffect(fn: () => void | (() => void), deps?: any[]): void;
  export function useMemo<T>(fn: () => T, deps: any[]): T;
  export function useCallback<T extends (...args: any[]) => any>(fn: T, deps: any[]): T;
  export function useRef<T>(init: T): MutableRefObject<T>;
  export function useRef<T>(init: T | null): RefObject<T>;
  export function useRef<T = undefined>(): MutableRefObject<T | undefined>;
  export function useId(): string;
  export function useTransition(): [boolean, (fn: () => void) => void];
  export function useDeferredValue<T>(v: T): T;
  export function memo<T>(c: T): T;
  export function forwardRef<T, P = {}>(c: any): any;
  export function lazy<T>(f: () => Promise<any>): any;
  export const Fragment: any;
  export const Suspense: any;
  export const StrictMode: any;
  export function startTransition(fn: () => void): void;
  const React: any;
  export default React;
}

declare module "react-dom" {
  const x: any;
  export = x;
}

declare module "@tanstack/react-router" {
  export const createFileRoute: any;
  export const createRootRoute: any;
  export function createRootRouteWithContext<T = any>(): any;
  export const Link: any;
  export const Outlet: any;
  export const HeadContent: any;
  export const Scripts: any;
  export const useRouter: any;
  export const useRouterState: any;
  export const useNavigate: any;
  export const useLocation: any;
  export const useParams: any;
  export const useSearch: any;
  export const useLoaderData: any;
  export const useMatch: any;
  export const useMatches: any;
  export const Navigate: any;
  export const notFound: any;
  export const redirect: any;
  export const isNotFound: any;
  export const ErrorComponent: any;
  export const CatchBoundary: any;
  export type ErrorComponentProps = { error: unknown; reset?: () => void; info?: any };
  export type NotFoundRouteProps = any;
  export type AnyRoute = any;
  export type LinkProps = any;
  export type RegisteredRouter = any;
}

declare module "@tanstack/react-start" {
  export const createServerFn: any;
  export function useServerFn<T = any>(fn: T): any;
  export const createMiddleware: any;
  export const createStart: any;
  export const createServerFileRoute: any;
  export const json: any;
}

declare module "@tanstack/react-start/server" {
  export const createStartHandler: any;
  export const defaultStreamHandler: any;
  export const defineHandlerCallback: any;
  export const getRequest: any;
  export const getRequestHeader: any;
  export const setResponseHeader: any;
  export const setResponseStatus: any;
  export const getRequestHeaders: any;
}

declare module "@tanstack/react-start/server-entry" {
  const handler: any;
  export default handler;
}

declare module "@tanstack/react-query" {
  export function useQuery<T = any>(opts: any): any;
  export const useQueries: any;
  export const useMutation: any;
  export const useQueryClient: any;
  export class QueryClient {
    [k: string]: any;
    constructor(config?: any);
  }
  export const QueryClientProvider: any;
  export const keepPreviousData: any;
}

declare module "lucide-react" {
  export type LucideIcon = any;
  export const AlertTriangle: any;
  export const ArrowLeft: any;
  export const CalendarDays: any;
  export const Captions: any;
  export const Check: any;
  export const ChevronRight: any;
  export const Download: any;
  export const Eye: any;
  export const EyeOff: any;
  export const Gauge: any;
  export const Home: any;
  export const Info: any;
  export const Languages: any;
  export const Loader2: any;
  export const Mail: any;
  export const MapPin: any;
  export const Maximize: any;
  export const Menu: any;
  export const Mic2: any;
  export const Minimize: any;
  export const MonitorPlay: any;
  export const Moon: any;
  export const Pencil: any;
  export const Play: any;
  export const Plus: any;
  export const Radio: any;
  export const RefreshCw: any;
  export const Search: any;
  export const Send: any;
  export const Server: any;
  export const Settings: any;
  export const Smartphone: any;
  export const Star: any;
  export const Sun: any;
  export const Trash2: any;
  export const Tv: any;
  export const Wifi: any;
  export const X: any;
  export const Zap: any;
  export const Pause: any;
  export const RotateCcw: any;
  export const RotateCw: any;
  export const Volume1: any;
  export const Volume2: any;
  export const VolumeX: any;
  export const SkipForward: any;
  export const ChevronLeft: any;
  export const Clock: any;
  export const ExternalLink: any;
}

declare module "react/jsx-runtime" {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare module "@capacitor/app" {
  export const App: any;
}

declare module "hls.js" {
  class Hls {
    [k: string]: any;
    static isSupported(): boolean;
    static Events: any;
    static ErrorTypes: any;
    static ErrorDetails: any;
    constructor(config?: any);
  }
  export default Hls;
  export type ErrorData = any;
  export type Level = any;
}

declare module "@supabase/supabase-js" {
  export const createClient: any;
  export type SupabaseClient = any;
}

declare module "*.css?url" {
  const url: string;
  export default url;
}
declare module "*.css" {
  const url: string;
  export default url;
}
declare module "*.png" {
  const url: string;
  export default url;
}
declare module "*.jpg" {
  const url: string;
  export default url;
}
declare module "*.svg" {
  const url: string;
  export default url;
}

interface ImportMeta {
  env: Record<string, string | undefined> & { DEV?: boolean; PROD?: boolean; SSR?: boolean };
}
