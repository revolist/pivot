import { useEffect, useRef } from 'react';
import { mountChartsDemo } from './charts-mount';
export default function ChartsDemo() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => host.current ? mountChartsDemo(host.current) : undefined, []);
  return <div ref={host} className="pivot-charts-embed" />;
}
