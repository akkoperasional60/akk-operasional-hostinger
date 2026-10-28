import React, { useMemo } from 'react';
import ReactFlow, { Background, Controls, MiniMap, Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';

// Mock schema based on typical logistics application structure
const initialNodes: Node[] = [
  { id: '1', data: { label: 'Schedule' }, position: { x: 50, y: 50 }, style: { background: '#1e293b', color: '#fff', padding: 10, borderRadius: 8 } },
  { id: '2', data: { label: 'Fleet' }, position: { x: 250, y: 50 }, style: { background: '#1e293b', color: '#fff', padding: 10, borderRadius: 8 } },
  { id: '3', data: { label: 'Crew' }, position: { x: 50, y: 200 }, style: { background: '#1e293b', color: '#fff', padding: 10, borderRadius: 8 } },
  { id: '4', data: { label: 'RetailStore' }, position: { x: 250, y: 200 }, style: { background: '#1e293b', color: '#fff', padding: 10, borderRadius: 8 } },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', label: 'fleetId' },
  { id: 'e1-3', source: '1', target: '3', label: 'crewId' },
  { id: 'e1-4', source: '1', target: '4', label: 'storeId' },
];

export const DatabaseSchemaExplorer: React.FC = () => {
  return (
    <div className="h-[500px] w-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
      <ReactFlow nodes={initialNodes} edges={initialEdges} fitView>
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
};
