import { useEffect, useRef } from 'react';
import { mountRemoteScaleDemo } from './remote-demo';

export default function RemoteScaleDemo() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => host.current ? mountRemoteScaleDemo(host.current) : undefined, []);
  return <div ref={host} className="pivot-scale-embed" />;
}
