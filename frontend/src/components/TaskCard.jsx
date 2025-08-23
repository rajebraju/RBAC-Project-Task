import React from 'react';

export default function TaskCard({ task, onStatusChange }) {
  return (
    <div style={{
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '12px',
      margin: '8px 0',
      backgroundColor: '#f9f9f9',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <h3>{task.project?.name}</h3>
      <h3>{task.title}</h3>
      <p>{task.description || 'No description'}</p>
      <p>
        <strong>Status:</strong> 
        <select 
          value={task.status} 
          onChange={(e) => onStatusChange(task._id, e.target.value)}
          disabled={!onStatusChange}
        >
          <option>To Do</option>
          <option>In Progress</option>
          <option>Completed</option>
        </select>
      </p>
      <p><strong>Assigned to:</strong> {task.assignedTo?.name || 'Unassigned'}</p>
      <small>Created by: {task.createdBy?.name || 'Unknown'}</small>
    </div>
  );
}