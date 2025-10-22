import React from 'react';
import { getWorkoutProgress } from '../utils/programGenerator';
import './Calendar.css';

function Calendar({ workouts, completedDays, onDayClick, selectedDay, completedExercises }) {
  const weeks = [];
  for (let i = 0; i < workouts.length; i += 7) {
    weeks.push(workouts.slice(i, i + 7));
  }

  return (
    <div className="calendar">
      {weeks.map((week, weekIndex) => (
        <div key={weekIndex} className="week">
          <h3 className="week-title">Hafta {weekIndex + 1}</h3>
          <div className="days-grid">
            {week.map(workout => {
              const progress = getWorkoutProgress(workout, completedExercises);
              return (
                <div
                  key={workout.day}
                  className={`day-card ${
                    selectedDay?.day === workout.day ? 'selected' : ''
                  } ${completedDays.includes(workout.day) ? 'completed' : ''}`}
                  onClick={() => onDayClick(workout)}
                >
                  <div className="day-number">Gün {workout.day}</div>
                  <div className="day-title">{workout.title}</div>
                  {workout.focus && (
                    <div className="day-focus">{workout.focus}</div>
                  )}
                  <div className="day-duration">≈ {workout.targetDuration} dk · {Math.round(workout.estimatedCalories || 0)} kcal</div>
                  <div className="day-progress">
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                    <span className="progress-text">%{progress.percent}</span>
                  </div>
                  {completedDays.includes(workout.day) && (
                    <div className="check-mark">✓</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default Calendar;
