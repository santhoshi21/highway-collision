
import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface Vehicle {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  speed: number;
  lane: number;
  isOvertaking: boolean;
  targetLane: number;
}

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 600;
const LANE_WIDTH = 120;
const LANE_COUNT = 3;
const HIGHWAY_Y = 150;

const HighwayAnimation: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [collisionOccurred, setCollisionOccurred] = useState(false);
  const [showExplosion, setShowExplosion] = useState(false);

  const vehiclesRef = useRef<Vehicle[]>([
    // Truck (center lane)
    {
      x: 200,
      y: HIGHWAY_Y + LANE_WIDTH + (LANE_WIDTH - 40) / 2,
      width: 80,
      height: 40,
      color: '#3B82F6',
      speed: 2,
      lane: 1,
      isOvertaking: false,
      targetLane: 1
    },
    // Car 1 (right lane) - will overtake
    {
      x: 120,
      y: HIGHWAY_Y + LANE_WIDTH * 2 + (LANE_WIDTH - 30) / 2,
      width: 50,
      height: 30,
      color: '#EF4444',
      speed: 3.5,
      lane: 2,
      isOvertaking: false,
      targetLane: 2
    },
    // Car 2 (left lane)
    {
      x: 250,
      y: HIGHWAY_Y + (LANE_WIDTH - 30) / 2,
      width: 50,
      height: 30,
      color: '#10B981',
      speed: 2.5,
      lane: 0,
      isOvertaking: false,
      targetLane: 0
    }
  ]);

  const timeRef = useRef(0);
  const explosionParticles = useRef<Array<{x: number, y: number, vx: number, vy: number, life: number}>>([]);

  const drawHighway = (ctx: CanvasRenderingContext2D) => {
    // Clear canvas
    ctx.fillStyle = '#10B981';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Highway background
    ctx.fillStyle = '#374151';
    ctx.fillRect(0, HIGHWAY_Y, CANVAS_WIDTH, LANE_WIDTH * LANE_COUNT);
    
    // Lane dividers
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 3;
    ctx.setLineDash([20, 15]);
    
    for (let i = 1; i < LANE_COUNT; i++) {
      ctx.beginPath();
      ctx.moveTo(0, HIGHWAY_Y + i * LANE_WIDTH);
      ctx.lineTo(CANVAS_WIDTH, HIGHWAY_Y + i * LANE_WIDTH);
      ctx.stroke();
    }
    
    // Highway borders
    ctx.setLineDash([]);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, HIGHWAY_Y);
    ctx.lineTo(CANVAS_WIDTH, HIGHWAY_Y);
    ctx.moveTo(0, HIGHWAY_Y + LANE_WIDTH * LANE_COUNT);
    ctx.lineTo(CANVAS_WIDTH, HIGHWAY_Y + LANE_WIDTH * LANE_COUNT);
    ctx.stroke();
  };

  const drawVehicle = (ctx: CanvasRenderingContext2D, vehicle: Vehicle) => {
    ctx.fillStyle = vehicle.color;
    ctx.fillRect(vehicle.x, vehicle.y, vehicle.width, vehicle.height);
    
    // Vehicle details
    ctx.fillStyle = '#1F2937';
    // Windows
    ctx.fillRect(vehicle.x + 5, vehicle.y + 5, vehicle.width - 10, vehicle.height - 10);
    
    // Wheels
    ctx.fillStyle = '#000000';
    const wheelSize = 8;
    ctx.fillRect(vehicle.x + 5, vehicle.y - 3, wheelSize, wheelSize);
    ctx.fillRect(vehicle.x + vehicle.width - 13, vehicle.y - 3, wheelSize, wheelSize);
    ctx.fillRect(vehicle.x + 5, vehicle.y + vehicle.height - 5, wheelSize, wheelSize);
    ctx.fillRect(vehicle.x + vehicle.width - 13, vehicle.y + vehicle.height - 5, wheelSize, wheelSize);
  };

  const drawExplosion = (ctx: CanvasRenderingContext2D) => {
    explosionParticles.current.forEach(particle => {
      ctx.fillStyle = `rgba(255, ${Math.floor(particle.life * 100)}, 0, ${particle.life})`;
      ctx.fillRect(particle.x, particle.y, 4, 4);
    });
  };

  const createExplosion = (x: number, y: number) => {
    explosionParticles.current = [];
    for (let i = 0; i < 30; i++) {
      explosionParticles.current.push({
        x: x + Math.random() * 80 - 40,
        y: y + Math.random() * 60 - 30,
        vx: (Math.random() - 0.5) * 15,
        vy: (Math.random() - 0.5) * 15,
        life: 1
      });
    }
    setShowExplosion(true);
  };

  const checkCollision = (vehicle1: Vehicle, vehicle2: Vehicle): boolean => {
    // Add some padding to make collision detection more accurate
    const padding = 5;
    return (
      vehicle1.x < vehicle2.x + vehicle2.width - padding &&
      vehicle1.x + vehicle1.width - padding > vehicle2.x &&
      vehicle1.y < vehicle2.y + vehicle2.height - padding &&
      vehicle1.y + vehicle1.height - padding > vehicle2.y
    );
  };

  const updateVehicles = () => {
    if (collisionOccurred) return; // Stop updating if collision occurred

    const vehicles = vehiclesRef.current;
    timeRef.current += 1;

    // Start overtaking after 2 seconds
    if (timeRef.current > 120 && !vehicles[1].isOvertaking) {
      vehicles[1].isOvertaking = true;
      vehicles[1].targetLane = 0; // Move to left lane
    }

    vehicles.forEach((vehicle, index) => {
      // Move forward only if no collision
      if (!collisionOccurred) {
        vehicle.x += vehicle.speed;
      }

      // Handle lane changing for overtaking car
      if (vehicle.isOvertaking && !collisionOccurred) {
        const targetY = HIGHWAY_Y + vehicle.targetLane * LANE_WIDTH + (LANE_WIDTH - vehicle.height) / 2;
        const laneChangeSpeed = 3;
        
        if (Math.abs(vehicle.y - targetY) > laneChangeSpeed) {
          vehicle.y += vehicle.y < targetY ? laneChangeSpeed : -laneChangeSpeed;
        } else {
          vehicle.y = targetY;
          vehicle.lane = vehicle.targetLane;
        }
      }

      // Check for collision between car1 (index 1) and car2 (index 2)
      if (index === 1 && !collisionOccurred) {
        if (checkCollision(vehicles[1], vehicles[2])) {
          console.log('COLLISION DETECTED!');
          setCollisionOccurred(true);
          createExplosion((vehicles[1].x + vehicles[2].x) / 2, (vehicles[1].y + vehicles[2].y) / 2);
          
          // Stop all vehicles immediately
          vehicles.forEach(v => {
            v.speed = 0;
          });
          
          // Stop the animation
          setIsPlaying(false);
        }
      }

      // Reset position when off screen (only if no collision)
      if (vehicle.x > CANVAS_WIDTH && !collisionOccurred) {
        vehicle.x = -vehicle.width;
      }
    });

    // Update explosion particles
    if (showExplosion) {
      explosionParticles.current.forEach(particle => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= 0.015;
      });
      
      explosionParticles.current = explosionParticles.current.filter(p => p.life > 0);
      
      if (explosionParticles.current.length === 0) {
        setShowExplosion(false);
      }
    }
  };

  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    updateVehicles();

    drawHighway(ctx);
    
    vehiclesRef.current.forEach(vehicle => {
      drawVehicle(ctx, vehicle);
    });

    if (showExplosion) {
      drawExplosion(ctx);
    }

    // Add collision text
    if (collisionOccurred) {
      ctx.fillStyle = '#FF0000';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.strokeText('COLLISION!', CANVAS_WIDTH / 2, 100);
      ctx.fillText('COLLISION!', CANVAS_WIDTH / 2, 100);
    }

    if (isPlaying && !collisionOccurred) {
      animationRef.current = requestAnimationFrame(animate);
    }
  };

  const startAnimation = () => {
    if (!collisionOccurred) {
      setIsPlaying(true);
    }
  };

  const pauseAnimation = () => {
    setIsPlaying(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  const resetAnimation = () => {
    setIsPlaying(false);
    setCollisionOccurred(false);
    setShowExplosion(false);
    timeRef.current = 0;
    explosionParticles.current = [];
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    // Reset vehicles to initial positions
    vehiclesRef.current = [
      {
        x: 200,
        y: HIGHWAY_Y + LANE_WIDTH + (LANE_WIDTH - 40) / 2,
        width: 80,
        height: 40,
        color: '#3B82F6',
        speed: 2,
        lane: 1,
        isOvertaking: false,
        targetLane: 1
      },
      {
        x: 120,
        y: HIGHWAY_Y + LANE_WIDTH * 2 + (LANE_WIDTH - 30) / 2,
        width: 50,
        height: 30,
        color: '#EF4444',
        speed: 3.5,
        lane: 2,
        isOvertaking: false,
        targetLane: 2
      },
      {
        x: 250,
        y: HIGHWAY_Y + (LANE_WIDTH - 30) / 2,
        width: 50,
        height: 30,
        color: '#10B981',
        speed: 2.5,
        lane: 0,
        isOvertaking: false,
        targetLane: 0
      }
    ];

    // Draw initial state
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawHighway(ctx);
        vehiclesRef.current.forEach(vehicle => {
          drawVehicle(ctx, vehicle);
        });
      }
    }
  };

  useEffect(() => {
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  useEffect(() => {
    resetAnimation();
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Highway Collision Animation</h1>
        <p className="text-gray-600 mb-4">
          Watch as the red car attempts to overtake the blue truck, leading to a collision with the green car
        </p>
      </div>
      
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border-2 border-gray-300 rounded-lg shadow-lg"
      />
      
      <div className="flex gap-4">
        <Button
          onClick={isPlaying ? pauseAnimation : startAnimation}
          variant="default"
          size="lg"
          disabled={collisionOccurred && !isPlaying}
        >
          {isPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
          {isPlaying ? 'Pause' : 'Play'}
        </Button>
        
        <Button
          onClick={resetAnimation}
          variant="outline"
          size="lg"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset
        </Button>
      </div>
      
      <div className="text-center text-sm text-gray-500 max-w-2xl">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span>Truck</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span>Car 1 (Overtaking)</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span>Car 2</span>
          </div>
        </div>
        <p>
          The red car attempts to overtake the blue truck by moving into the left lane, 
          where it collides with the green car. All vehicles stop immediately upon collision.
        </p>
      </div>
    </div>
  );
};

export default HighwayAnimation;
