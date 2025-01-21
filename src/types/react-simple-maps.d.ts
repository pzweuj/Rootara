declare module 'react-simple-maps' {
  import { ReactNode } from 'react';

  export interface GeographyProps {
    geography: any;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    style?: object;
    className?: string;
    onClick?: (event: MouseEvent) => void;
    onMouseEnter?: (event: MouseEvent) => void;
    onMouseLeave?: (event: MouseEvent) => void;
  }

  export interface ComposableMapProps {
    children?: ReactNode;
    projection?: string;
    projectionConfig?: object;
    width?: number;
    height?: number;
    style?: object;
    className?: string;
  }

  export interface MarkerProps {
    coordinates: [number, number];
    children?: ReactNode;
    style?: object;
    className?: string;
  }

  export interface GeographiesProps {
    geography: string | object;
    children: (props: { geographies: any[] }) => ReactNode;
  }

  export const ComposableMap: React.FC<ComposableMapProps>;
  export const Geographies: React.FC<GeographiesProps>;
  export const Geography: React.FC<GeographyProps>;
  export const Marker: React.FC<MarkerProps>;
} 