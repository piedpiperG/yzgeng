import { geoEquirectangular, geoGraticule10, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import worldAtlas from 'world-atlas/countries-110m.json';
import type { TravelMapConfig, TravelMapPoint } from '@/lib/config';

interface TravelMapProps {
    map?: TravelMapConfig;
}

const MAP_WIDTH = 360;
const MAP_HEIGHT = 225;
const worldTopology = worldAtlas as unknown as Topology<{ countries: GeometryCollection }>;
const countries = worldTopology.objects.countries;
const land = feature(worldTopology, countries);
const borders = mesh(worldTopology, countries, (a, b) => a !== b);
const projection = geoEquirectangular().fitExtent(
    [[8, 8], [MAP_WIDTH - 8, MAP_HEIGHT - 8]],
    {
        type: 'MultiPoint',
        coordinates: [
            [-25, -55],
            [180, 80],
        ],
    }
).clipExtent([[8, 8], [MAP_WIDTH - 8, MAP_HEIGHT - 8]]);
const pathGenerator = geoPath(projection);
const landPath = pathGenerator(land) || '';
const borderPath = pathGenerator(borders) || '';
const graticulePath = pathGenerator(geoGraticule10()) || '';

function projectPoint(point: TravelMapPoint) {
    const projected = projection([point.lng, point.lat]);
    const left = projected ? (projected[0] / MAP_WIDTH) * 100 : 50;
    const top = projected ? (projected[1] / MAP_HEIGHT) * 100 : 50;

    return {
        left: Math.min(94, Math.max(6, left)),
        top: Math.min(91, Math.max(9, top)),
    };
}

function layoutPoints(points: TravelMapPoint[]) {
    const offsets = [
        { left: 0, top: 0 },
        { left: 3, top: -3 },
        { left: -3, top: 3 },
        { left: 4, top: 3 },
        { left: -4, top: -3 },
        { left: 0, top: 6 },
        { left: 0, top: -6 },
        { left: 6, top: 0 },
        { left: -6, top: 0 },
        { left: 6, top: 6 },
        { left: -6, top: -6 },
        { left: 7, top: -5 },
        { left: -7, top: 5 },
        { left: 9, top: 2 },
        { left: -9, top: -2 },
    ];
    const placed: Array<{ point: TravelMapPoint; position: { left: number; top: number } }> = [];

    for (const point of points) {
        const projected = projectPoint(point);
        const offset = offsets.find((candidate) => {
            const left = Math.min(94, Math.max(6, projected.left + candidate.left));
            const top = Math.min(91, Math.max(9, projected.top + candidate.top));
            return placed.every(({ position }) => (
                Math.abs(position.left - left) >= 3.5 || Math.abs(position.top - top) >= 5
            ));
        }) || offsets[0];

        placed.push({
            point,
            position: {
                left: Math.min(94, Math.max(6, projected.left + offset.left)),
                top: Math.min(91, Math.max(9, projected.top + offset.top)),
            },
        });
    }

    return placed;
}

export default function TravelMap({ map }: TravelMapProps) {
    const points = map?.points?.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)) || [];
    const placedPoints = layoutPoints(points);

    if (points.length === 0) {
        return null;
    }

    return (
        <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4 mb-6 hover:shadow-lg transition-all duration-200 hover:scale-[1.02]">
            <div className="mb-3">
                <h3 className="font-semibold text-primary">{map?.title || 'Footprints'}</h3>
                {map?.subtitle && (
                    <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-500">
                        {map.subtitle}
                    </p>
                )}
            </div>

            <div className="relative aspect-[16/10] overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-[rgba(148,163,184,0.24)] dark:bg-neutral-900">
                <svg
                    aria-hidden="true"
                    viewBox="0 0 360 225"
                    className="absolute inset-0 h-full w-full"
                    preserveAspectRatio="xMidYMid meet"
                >
                    <rect
                        x="8"
                        y="8"
                        width={MAP_WIDTH - 16}
                        height={MAP_HEIGHT - 16}
                        rx="8"
                        className="fill-sky-50 stroke-neutral-300 dark:fill-slate-950 dark:stroke-neutral-700"
                        strokeWidth="1"
                    />
                    <path
                        d={graticulePath}
                        className="fill-none stroke-neutral-200/80 dark:stroke-neutral-700/55"
                        strokeWidth="0.55"
                        strokeDasharray="2 3"
                    />
                    <path
                        d={landPath}
                        className="fill-neutral-200/90 stroke-white/80 dark:fill-neutral-700/80 dark:stroke-neutral-800"
                        strokeWidth="0.7"
                    />
                    <path
                        d={borderPath}
                        className="fill-none stroke-white/80 dark:stroke-neutral-800/90"
                        strokeWidth="0.45"
                    />
                </svg>

                {placedPoints.map(({ point, position }) => (
                    <span
                        key={`${point.label}-${point.lat}-${point.lng}`}
                        aria-hidden="true"
                        className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent shadow-sm dark:border-neutral-900"
                        style={{ left: `${position.left}%`, top: `${position.top}%` }}
                    />
                ))}
            </div>
        </div>
    );
}
