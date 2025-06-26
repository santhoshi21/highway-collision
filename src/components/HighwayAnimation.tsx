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

const CANVAS_WIDTH = 1200;
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
  const [animationEnded, setAnimationEnded] = useState(false);

  const vehiclesRef = useRef<Vehicle[]>([
    // Large Truck (center lane) - creates blind spot
    {
      x: 300,
      y: HIGHWAY_Y + LANE_WIDTH + (LANE_WIDTH - 60) / 2,
      width: 140, // Much larger truck
      height: 60,
      color: '#3B82F6',
      speed: 1.8,
      lane: 1,
      isOvertaking: false,
      targetLane: 1
    },
    // Car 1 (right lane) - will overtake and can't see car2 due to blind spot
    {
      x: 150,
      y: HIGHWAY_Y + LANE_WIDTH * 2 + (LANE_WIDTH - 30) / 2,
      width: 50,
      height: 30,
      color: '#EF4444',
      speed: 3.5,
      lane: 2,
      isOvertaking: false,
      targetLane: 2
    },
    // Car 2 (left lane) - hidden behind truck, moving slower
    {
      x: 380, // Positioned behind truck creating blind spot
      y: HIGHWAY_Y + (LANE_WIDTH - 30) / 2,
      width: 50,
      height: 30,
      color: '#10B981',
      speed: 2.2,
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
    const wheelSize = vehicle.width > 80 ? 12 : 8; // Larger wheels for truck
    ctx.fillRect(vehicle.x + 8, vehicle.y - 4, wheelSize, wheelSize);
    ctx.fillRect(vehicle.x + vehicle.width - 20, vehicle.y - 4, wheelSize, wheelSize);
    ctx.fillRect(vehicle.x + 8, vehicle.y + vehicle.height - 8, wheelSize, wheelSize);
    ctx.fillRect(vehicle.x + vehicle.width - 20, vehicle.y + vehicle.height - 8, wheelSize, wheelSize);
  };

  const drawExplosion = (ctx: CanvasRenderingContext2D) => {
    explosionParticles.current.forEach(particle => {
      ctx.fillStyle = `rgba(255, ${Math.floor(particle.life * 150)}, 0, ${particle.life})`;
      ctx.fillRect(particle.x, particle.y, 8, 8);
    });
  };

  const createExplosion = (x: number, y: number) => {
    explosionParticles.current = [];
    for (let i = 0; i < 50; i++) {
      explosionParticles.current.push({
        x: x + Math.random() * 120 - 60,
        y: y + Math.random() * 100 - 50,
        vx: (Math.random() - 0.5) * 25,
        vy: (Math.random() - 0.5) * 25,
        life: 1
      });
    }
    setShowExplosion(true);
  };

  const checkCollision = (vehicle1: Vehicle, vehicle2: Vehicle): boolean => {
    const buffer = 5;
    return (
      vehicle1.x < vehicle2.x + vehicle2.width + buffer &&
      vehicle1.x + vehicle1.width + buffer > vehicle2.x &&
      vehicle1.y < vehicle2.y + vehicle2.height + buffer &&
      vehicle1.y + vehicle1.height + buffer > vehicle2.y
    );
  };

  const updateVehicles = () => {
    if (collisionOccurred || animationEnded) return;

    const vehicles = vehiclesRef.current;
    timeRef.current += 1;

    // Car1 starts overtaking when it gets closer to the truck (blind spot scenario)
    if (timeRef.current > 60 && !vehicles[1].isOvertaking && vehicles[1].x > 200) {
      vehicles[1].isOvertaking = true;
      vehicles[1].targetLane = 0; // Move to left lane to overtake
      console.log('Car1 starting overtake maneuver - entering blind spot area');
    }

    vehicles.forEach((vehicle, index) => {
      // Move forward - all vehicles continue moving until collision
      vehicle.x += vehicle.speed;

      // Handle lane changing for overtaking car (Car1)
      if (vehicle.isOvertaking && index === 1) {
        const targetY = HIGHWAY_Y + vehicle.targetLane * LANE_WIDTH + (LANE_WIDTH - vehicle.height) / 2;
        const laneChangeSpeed = 3.5; // Smooth lane change
        
        if (Math.abs(vehicle.y - targetY) > laneChangeSpeed) {
          vehicle.y += vehicle.y < targetY ? laneChangeSpeed : -laneChangeSpeed;
        } else {
          vehicle.y = targetY;
          vehicle.lane = vehicle.targetLane;
        }
      }

      // Check for collision between car1 and car2 (the blind spot accident)
      if (index === 1 && !collisionOccurred) {
        if (checkCollision(vehicles[1], vehicles[2])) {
          console.log('BLIND SPOT ACCIDENT! Car1 collided with Car2 - both were in the same lane');
          setCollisionOccurred(true);
          
          // Create explosion at collision point
          const collisionX = (vehicles[1].x + vehicles[2].x + vehicles[2].width) / 2;
          const collisionY = (vehicles[1].y + vehicles[2].y + vehicles[2].height) / 2;
          createExplosion(collisionX, collisionY);
          
          // STOP ALL VEHICLES IMMEDIATELY - no more movement
          vehicles.forEach(v => {
            v.speed = 0;
          });
          
          // End animation after showing explosion
          setTimeout(() => {
            setAnimationEnded(true);
            setIsPlaying(false);
            console.log('Animation ended - accident scenario complete');
          }, 2500);
        }
      }
    });

    // Update explosion particles
    if (showExplosion) {
      explosionParticles.current.forEach(particle => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= 0.96;
        particle.vy *= 0.96;
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

    // Add accident text
    if (collisionOccurred) {
      ctx.fillStyle = '#FF0000';
      ctx.font = 'bold 52px Arial';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 4;
      ctx.strokeText('BLIND SPOT ACCIDENT!', CANVAS_WIDTH / 2, 100);
      ctx.fillText('BLIND SPOT ACCIDENT!', CANVAS_WIDTH / 2, 100);
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px Arial';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeText('Animation Complete', CANVAS_WIDTH / 2, 140);
      ctx.fillText('Animation Complete', CANVAS_WIDTH / 2, 140);
    }

    if (isPlaying && !animationEnded) {
      animationRef.current = requestAnimationFrame(animate);
    }
  };

  const startAnimation = () => {
    if (!animationEnded) {
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
    setAnimationEnded(false);
    timeRef.current = 0;
    explosionParticles.current = [];
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    // Reset vehicles to initial positions
    vehiclesRef.current = [
      {
        x: 300,
        y: HIGHWAY_Y + LANE_WIDTH + (LANE_WIDTH - 60) / 2,
        width: 140,
        height: 60,
        color: '#3B82F6',
        speed: 1.8,
        lane: 1,
        isOvertaking: false,
        targetLane: 1
      },
      {
        x: 150,
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
        x: 380,
        y: HIGHWAY_Y + (LANE_WIDTH - 30) / 2,
        width: 50,
        height: 30,
        color: '#10B981',
        speed: 2.2,
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
        <h1 className="text-3xl font-bold mb-2">Highway Blind Spot Accident Simulation</h1>
        <p className="text-gray-600 mb-4">
          A realistic visualization of how blind spots created by large vehicles lead to highway accidents
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
          disabled={animationEnded && !isPlaying}
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
      
      <div className="text-center text-sm text-gray-500 max-w-3xl">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="flex items-center justify-center gap-2">
            <div className="w-6 h-4 bg-blue-500 rounded"></div>
            <span>Large Truck (Creates Blind Spot)</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span>Car 1 (Overtaking)</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span>Car 2 (Hidden in Blind Spot)</span>
          </div>
        </div>
        <p className="text-left leading-relaxed">
          <strong>Scenario:</strong> The large truck creates a blind spot where Car 2 is hidden from Car 1's view. 
          When Car 1 decides to overtake and change lanes, it cannot see Car 2 approaching in the same lane due to the truck's blind spot. 
          This results in a collision that commonly occurs on highways. All vehicles stop immediately after the accident, 
          demonstrating the importance of checking blind spots and maintaining safe following distances.
        </p>
      </div>
    </div>
  );
};

export default HighwayAnimation;
