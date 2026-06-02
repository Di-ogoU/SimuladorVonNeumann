"use client";

import { useEffect, useMemo, useState } from "react";

type MemoryData = {
  A: number | null;
  B: number | null;
  C: number | null;
};

type SimulationState = {
  loaded: boolean;
  isFinished: boolean;
  pc: number;
  ir: string;
  acc: number;
  memory: MemoryData;
  output: number | null;
  currentInstructionIndex: number;
  microStepIndex: number;
  activePath: string;
  packet: string;
  stage: string;
  explanation: string;
  history: string[];
};

type ProgramKey = "sum" | "multiply" | "copy";

type ProgramDefinition = {
  key: ProgramKey;
  name: string;
  shortName: string;
  description: string;
  instructions: string[];
  usesInputB: boolean;
  expectedExample: string;
};

const PROGRAMS: Record<ProgramKey, ProgramDefinition> = {
  sum: {
    key: "sum",
    name: "Suma de dos valores",
    shortName: "Suma",
    description:
      "Carga A en el acumulador, suma B usando la ALU, guarda el resultado en C y lo muestra en salida.",
    instructions: ["INPUT A", "INPUT B", "LOAD A", "ADD B", "STORE C", "OUTPUT C"],
    usesInputB: true,
    expectedExample: "Con A = 5 y B = 3, el resultado esperado es 8.",
  },
  multiply: {
    key: "multiply",
    name: "Multiplicacion de dos valores",
    shortName: "Multiplicacion",
    description:
      "Carga A en el acumulador, multiplica por B usando la ALU, guarda el resultado en C y lo muestra en salida.",
    instructions: ["INPUT A", "INPUT B", "LOAD A", "MUL B", "STORE C", "OUTPUT C"],
    usesInputB: true,
    expectedExample: "Con A = 5 y B = 3, el resultado esperado es 15.",
  },
  copy: {
    key: "copy",
    name: "Copia de datos",
    shortName: "Copia",
    description:
      "Carga el valor de A en el acumulador, lo guarda en C y lo muestra en salida. Sirve para visualizar transporte de datos sin calculo aritmetico.",
    instructions: ["INPUT A", "LOAD A", "STORE C", "OUTPUT C"],
    usesInputB: false,
    expectedExample: "Con A = 5, el resultado esperado es 5. El valor B no se usa.",
  },
};

const MAX_HISTORY = 8;

function createInitialState(): SimulationState {
  return {
    loaded: false,
    isFinished: false,
    pc: 0,
    ir: "",
    acc: 0,
    memory: {
      A: null,
      B: null,
      C: null,
    },
    output: null,
    currentInstructionIndex: 0,
    microStepIndex: 0,
    activePath: "none",
    packet: "Sin transferencia activa",
    stage: "INICIAL",
    explanation: "Carga el programa para comenzar la simulacion conceptual.",
    history: [],
  };
}

function createLoadedState(program: ProgramDefinition): SimulationState {
  return {
    ...createInitialState(),
    loaded: true,
    stage: "LISTO",
    explanation: `El programa "${program.name}" fue cargado y la CPU esta lista para comenzar el ciclo de busqueda, decodificacion y ejecucion.`,
    packet: "Programa listo",
    history: [`Programa cargado correctamente: ${program.name}.`],
  };
}

function normalizeNumber(value: string): number {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function pushHistory(history: string[], entry: string): string[] {
  return [...history, entry].slice(-MAX_HISTORY);
}

function stepSimulation(
  previousState: SimulationState,
  inputA: number,
  inputB: number,
  program: ProgramDefinition,
): SimulationState {
  if (!previousState.loaded || previousState.isFinished) {
    return previousState;
  }

  const instruction = program.instructions[previousState.currentInstructionIndex];

  if (!instruction) {
    return {
      ...previousState,
      isFinished: true,
      stage: "FINALIZADO",
      explanation: "El programa ya termino y no quedan instrucciones por ejecutar.",
      packet: "Programa completado",
      activePath: "none",
    };
  }

  if (previousState.microStepIndex === 0) {
    return {
      ...previousState,
      stage: "FETCH",
      activePath: "pc-to-memory",
      packet: `Direccion ${previousState.pc}`,
      explanation:
        `El contador de programa PC envia la direccion ${previousState.pc} de la siguiente instruccion hacia la memoria usando el bus de direcciones.`,
      history: pushHistory(
        previousState.history,
        `FETCH: PC envio direccion ${previousState.pc} a memoria.`,
      ),
      microStepIndex: 1,
    };
  }

  if (previousState.microStepIndex === 1) {
    return {
      ...previousState,
      stage: "FETCH",
      ir: instruction,
      activePath: "memory-to-ir",
      packet: instruction,
      explanation:
        "La memoria devuelve la instruccion almacenada en esa direccion y la CPU la carga en el registro IR.",
      history: pushHistory(previousState.history, `FETCH: IR recibio ${instruction}.`),
      microStepIndex: 2,
    };
  }

  if (previousState.microStepIndex === 2) {
    return {
      ...previousState,
      stage: "DECODE",
      activePath: "control-unit",
      packet: `Decodificar ${instruction}`,
      explanation:
        "La unidad de control interpreta la instruccion cargada en IR y prepara la operacion correspondiente.",
      history: pushHistory(
        previousState.history,
        `DECODE: Unidad de control interpreto ${instruction}.`,
      ),
      microStepIndex: 3,
    };
  }

  let nextMemory = previousState.memory;
  let nextAcc = previousState.acc;
  let nextOutput = previousState.output;
  let nextActivePath = "none";
  let nextPacket = "";
  let nextExplanation = "";
  let historyEntry = "";
  let isFinished: boolean = previousState.isFinished;
  let stage: string = "EXECUTE";

  switch (instruction) {
    case "INPUT A": {
      nextMemory = { ...previousState.memory, A: inputA };
      nextActivePath = "input-to-memory";
      nextPacket = `Dato ${inputA} -> A`;
      nextExplanation =
        "El valor ingresado por el usuario se transfiere desde el dispositivo de entrada hacia la memoria principal y queda guardado en la direccion A.";
      historyEntry = `EXECUTE: Entrada guardo ${inputA} en memoria A.`;
      break;
    }
    case "INPUT B": {
      nextMemory = { ...previousState.memory, B: inputB };
      nextActivePath = "input-to-memory";
      nextPacket = `Dato ${inputB} -> B`;
      nextExplanation =
        "El segundo valor ingresado por el usuario se transfiere desde la entrada hacia la memoria principal y queda guardado en la direccion B.";
      historyEntry = `EXECUTE: Entrada guardo ${inputB} en memoria B.`;
      break;
    }
    case "LOAD A": {
      nextAcc = previousState.memory.A ?? 0;
      nextActivePath = "memory-to-acc";
      nextPacket = "Dato A -> ACC";
      nextExplanation =
        "La CPU lee el dato almacenado en la direccion A de memoria y lo carga en el acumulador ACC.";
      historyEntry = `EXECUTE: ACC cargo ${nextAcc} desde memoria A.`;
      break;
    }
    case "ADD B": {
      const valueB = previousState.memory.B ?? 0;
      nextAcc = previousState.acc + valueB;
      nextActivePath = "memory-to-alu";
      nextPacket = `ACC + ${valueB}`;
      nextExplanation =
        "La ALU recibe el valor del acumulador y el dato almacenado en B, realiza la suma y guarda el resultado en ACC.";
      historyEntry = `EXECUTE: ALU sumo ACC con B y obtuvo ${nextAcc}.`;
      break;
    }
    case "MUL B": {
      const valueB = previousState.memory.B ?? 0;
      nextAcc = previousState.acc * valueB;
      nextActivePath = "memory-to-alu";
      nextPacket = `ACC x ${valueB}`;
      nextExplanation =
        "La ALU recibe el valor del acumulador y el dato almacenado en B, realiza la multiplicacion y guarda el resultado en ACC.";
      historyEntry = `EXECUTE: ALU multiplico ACC por B y obtuvo ${nextAcc}.`;
      break;
    }
    case "STORE C": {
      nextMemory = { ...previousState.memory, C: previousState.acc };
      nextActivePath = "acc-to-memory";
      nextPacket = "ACC -> C";
      nextExplanation =
        "El resultado calculado en el acumulador se envia por el bus de datos hacia la memoria principal y queda almacenado en la direccion C.";
      historyEntry = `EXECUTE: Memoria C guardo ${previousState.acc}.`;
      break;
    }
    case "OUTPUT C": {
      nextOutput = previousState.memory.C ?? 0;
      nextActivePath = "memory-to-output";
      nextPacket = "C -> Salida";
      nextExplanation =
        "El dato almacenado en la direccion C se transfiere desde memoria hacia el dispositivo de salida para mostrar el resultado final.";
      historyEntry = `EXECUTE: Salida mostro ${nextOutput} desde memoria C.`;
      isFinished = true;
      stage = "FINALIZADO";
      break;
    }
    default:
      break;
  }

  return {
    ...previousState,
    memory: nextMemory,
    acc: nextAcc,
    output: nextOutput,
    activePath: nextActivePath,
    packet: nextPacket,
    explanation: nextExplanation,
    history: pushHistory(previousState.history, historyEntry),
    pc: previousState.pc + 1,
    currentInstructionIndex: previousState.currentInstructionIndex + 1,
    microStepIndex: 0,
    isFinished,
    stage,
  };
}

type BoxProps = {
  title: string;
  subtitle?: string;
  active?: boolean;
  tone?: "blue" | "emerald" | "amber" | "violet" | "slate";
  children?: React.ReactNode;
  className?: string;
};

function DiagramBox({ title, subtitle, active = false, tone = "blue", children, className = "" }: BoxProps) {
  const tones: Record<NonNullable<BoxProps["tone"]>, string> = {
    blue: "border-blue-200 bg-blue-50/80 text-slate-900",
    emerald: "border-emerald-200 bg-emerald-50/80 text-slate-900",
    amber: "border-amber-200 bg-amber-50/80 text-slate-900",
    violet: "border-violet-200 bg-violet-50/80 text-slate-900",
    slate: "border-slate-200 bg-white text-slate-900",
  };

  return (
    <div
      className={[
        "rounded-2xl border p-5 shadow-sm transition-all lg:p-6",
        tones[tone],
        active ? "ring-2 ring-blue-400 shadow-md" : "",
        className,
      ].join(" ")}
    >
      <p className="text-sm font-semibold tracking-wide text-slate-900 lg:text-base">{title}</p>
      {subtitle ? <p className="mt-1 text-sm text-slate-600 lg:text-[15px]">{subtitle}</p> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

export default function Page() {
  const [simulation, setSimulation] = useState<SimulationState>(createInitialState);
  const [inputA, setInputA] = useState("5");
  const [inputB, setInputB] = useState("3");
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [selectedProgramKey, setSelectedProgramKey] = useState<ProgramKey>("sum");

  const selectedProgram = PROGRAMS[selectedProgramKey];
  const parsedInputA = useMemo(() => normalizeNumber(inputA), [inputA]);
  const parsedInputB = useMemo(() => normalizeNumber(inputB), [inputB]);
  const memoryInstructionRows = useMemo(
    () => selectedProgram.instructions.map((instruction, index) => ({
      address: String(index),
      content: instruction,
      type: "Instruccion",
    })),
    [selectedProgram],
  );

  function handleSelectProgram(programKey: ProgramKey) {
    setSelectedProgramKey(programKey);
    setIsAutoRunning(false);
    setSimulation(createLoadedState(PROGRAMS[programKey]));
  }

  function handleLoadProgram() {
    setIsAutoRunning(false);
    setSimulation(createLoadedState(selectedProgram));
  }

  function handleStep() {
    setSimulation((previousState) => {
      const baseState = previousState.loaded ? previousState : createLoadedState(selectedProgram);
      const nextState = stepSimulation(baseState, parsedInputA, parsedInputB, selectedProgram);

      if (nextState.isFinished) {
        setIsAutoRunning(false);
      }

      return nextState;
    });
  }

  function handleRunAll() {
    if (simulation.isFinished) {
      return;
    }

    setSimulation((previousState) => (previousState.loaded ? previousState : createLoadedState(selectedProgram)));
    setIsAutoRunning(true);
  }

  function handlePause() {
    setIsAutoRunning(false);
  }

  function handleReset() {
    setIsAutoRunning(false);
    setSimulation(createInitialState());
  }

  function getStatusLabel() {
    if (simulation.isFinished) {
      return "Finalizado";
    }

    if (isAutoRunning && simulation.loaded) {
      return "Ejecutando";
    }

    if (simulation.loaded) {
      return "Listo para ejecutar";
    }

    return "Programa no cargado";
  }

  function getInstructionState(index: number) {
    if (index < simulation.currentInstructionIndex) {
      return "executed";
    }

    if (index === simulation.currentInstructionIndex && !simulation.isFinished) {
      return "current";
    }

    return "pending";
  }

  useEffect(() => {
    if (!isAutoRunning || !simulation.loaded || simulation.isFinished) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSimulation((previousState) => {
        const nextState = stepSimulation(previousState, parsedInputA, parsedInputB, selectedProgram);

        if (nextState.isFinished) {
          setIsAutoRunning(false);
        }

        return nextState;
      });
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [isAutoRunning, parsedInputA, parsedInputB, selectedProgram, simulation]);

  const memoryRows = [
    ...memoryInstructionRows,
    {
      address: "A",
      content: simulation.memory.A ?? "vacio inicialmente",
      type: "Dato",
    },
    {
      address: "B",
      content: simulation.memory.B ?? "vacio inicialmente",
      type: "Dato",
    },
    {
      address: "C",
      content: simulation.memory.C ?? "vacio inicialmente",
      type: "Dato",
    },
  ];

  const pathHighlights = {
    memory:
      simulation.activePath === "pc-to-memory" ||
      simulation.activePath === "memory-to-ir" ||
      simulation.activePath === "input-to-memory" ||
      simulation.activePath === "memory-to-acc" ||
      simulation.activePath === "memory-to-alu" ||
      simulation.activePath === "acc-to-memory" ||
      simulation.activePath === "memory-to-output",
    cpu:
      simulation.activePath === "pc-to-memory" ||
      simulation.activePath === "memory-to-ir" ||
      simulation.activePath === "control-unit" ||
      simulation.activePath === "memory-to-acc" ||
      simulation.activePath === "memory-to-alu" ||
      simulation.activePath === "alu-to-acc" ||
      simulation.activePath === "acc-to-memory",
    input: simulation.activePath === "input-to-memory",
    output: simulation.activePath === "memory-to-output",
    control: simulation.activePath === "control-unit",
    alu:
      simulation.activePath === "memory-to-alu" ||
      simulation.activePath === "alu-to-acc",
    registers:
      simulation.activePath === "memory-to-ir" ||
      simulation.activePath === "memory-to-acc" ||
      simulation.activePath === "alu-to-acc" ||
      simulation.activePath === "pc-to-memory" ||
      simulation.activePath === "acc-to-memory",
    addressBus: simulation.activePath === "pc-to-memory",
    dataBus:
      simulation.activePath === "memory-to-ir" ||
      simulation.activePath === "memory-to-acc" ||
      simulation.activePath === "memory-to-alu" ||
      simulation.activePath === "acc-to-memory",
    controlBus: simulation.activePath === "control-unit",
    inputBus: simulation.activePath === "input-to-memory",
    outputBus: simulation.activePath === "memory-to-output",
  };

  const registerHighlights = {
    pc: simulation.activePath === "pc-to-memory",
    ir: simulation.activePath === "memory-to-ir",
    acc:
      simulation.activePath === "memory-to-acc" ||
      simulation.activePath === "alu-to-acc" ||
      simulation.activePath === "acc-to-memory",
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1520px] flex-col gap-6">
        <section className="rounded-[28px] bg-white px-6 py-7 shadow-md ring-1 ring-slate-200">
          <div className="mb-4 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
            Proyecto academico · Organizacion de Computadores
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Visualizador interactivo de arquitectura Von Neumann
          </h1>
          <p className="mt-3 max-w-4xl text-base leading-7 text-slate-600 sm:text-lg">
            Simulacion conceptual del transporte de instrucciones y datos entre CPU, memoria, buses y dispositivos de entrada/salida.
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Que se esta simulando?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Esta aplicacion representa de forma conceptual como una computadora basada en la arquitectura Von Neumann transporta instrucciones y datos entre memoria, CPU, buses y dispositivos de entrada/salida. El objetivo no es replicar un procesador real, sino visualizar el flujo basico de informacion durante la ejecucion de un programa simple. La app permite alternar entre suma, multiplicacion y copia de datos para comparar como cambian los recorridos de informacion dentro del mismo modelo.
            </p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Ciclo basico</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Cada instruccion pasa por tres momentos principales: busqueda de la instruccion en memoria, decodificacion en la unidad de control y ejecucion mediante registros, ALU, memoria o entrada/salida. En suma y multiplicacion se observa el trabajo de la ALU; en copia se observa principalmente el transporte de datos.
            </p>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-12 xl:items-start">
          <div className="space-y-4 xl:col-span-3">
            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">Explicacion del paso actual</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold tracking-wide text-slate-600">
                  {simulation.stage}
                </span>
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="rounded-2xl bg-slate-50 p-4 lg:p-5">
                  <p><span className="font-semibold">Etapa:</span> {simulation.stage}</p>
                  <p className="mt-2"><span className="font-semibold">Instruccion:</span> {simulation.ir || selectedProgram.instructions[simulation.currentInstructionIndex] || "Ninguna"}</p>
                  <p className="mt-2"><span className="font-semibold">Paquete:</span> {simulation.packet}</p>
                </div>
                <div className="rounded-2xl bg-blue-50 p-4 text-slate-800 ring-1 ring-blue-200 lg:p-5">
                  {simulation.explanation}
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:p-6">
              <h2 className="text-lg font-semibold text-slate-900">Tabla de memoria</h2>
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm lg:text-[15px]">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Direccion</th>
                      <th className="px-4 py-3 font-semibold">Contenido</th>
                      <th className="px-4 py-3 font-semibold">Tipo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {memoryRows.map((row, index) => {
                      const isActiveInstruction = index === simulation.currentInstructionIndex && index < selectedProgram.instructions.length;
                      const isDataRowActive =
                        (row.address === "A" && simulation.activePath === "input-to-memory" && simulation.ir === "INPUT A") ||
                        (row.address === "B" && simulation.activePath === "input-to-memory" && simulation.ir === "INPUT B") ||
                        (row.address === "A" && simulation.activePath === "memory-to-acc") ||
                        (row.address === "B" && simulation.activePath === "memory-to-alu" && (simulation.ir === "ADD B" || simulation.ir === "MUL B")) ||
                        (row.address === "C" && (simulation.activePath === "acc-to-memory" || simulation.activePath === "memory-to-output"));

                      return (
                        <tr
                          key={row.address}
                          className={[
                            isActiveInstruction || isDataRowActive ? "bg-blue-50" : "",
                            row.type === "Dato" ? "text-emerald-700" : "text-slate-700",
                          ].join(" ")}
                        >
                          <td className="px-4 py-3 font-semibold">{row.address}</td>
                          <td className="px-4 py-3">{row.content}</td>
                          <td className="px-4 py-3">{row.type}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          <div className="xl:col-span-6">
            <div className="overflow-hidden rounded-[30px] bg-white shadow-md ring-1 ring-slate-200">
              <div className="p-5 sm:p-6 lg:p-7">
                <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Diagrama visual de arquitectura Von Neumann</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Los bloques y buses se resaltan segun el micro-paso actual.
                    </p>
                  </div>
                  <div className="shrink-0 self-start rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 ring-1 ring-blue-200 animate-pulse">
                    {simulation.packet}
                  </div>
                </div>

                <div className="grid min-h-[560px] grid-cols-1 gap-8 xl:grid-cols-[0.9fr_1.2fr_1.4fr] xl:items-center">
                  <div className="flex flex-col items-center justify-center gap-5 xl:min-h-full">
                    <DiagramBox
                      title="Entrada"
                      subtitle="Valores del usuario"
                      active={pathHighlights.input}
                      tone="amber"
                      className="w-full max-w-44 px-5 py-6 text-center"
                    />

                    <div className="flex flex-col items-center gap-2">
                      <div className={[
                        "h-14 w-px rounded-full transition-all",
                        pathHighlights.inputBus || pathHighlights.outputBus ? "bg-blue-400 shadow-[0_0_0_6px_rgba(59,130,246,0.12)]" : "bg-slate-300",
                      ].join(" ")} />
                      <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
                        Flujo E/S
                      </div>
                      <div className={[
                        "h-14 w-px rounded-full transition-all",
                        pathHighlights.inputBus || pathHighlights.outputBus ? "bg-blue-400 shadow-[0_0_0_6px_rgba(59,130,246,0.12)]" : "bg-slate-300",
                      ].join(" ")} />
                    </div>

                    <DiagramBox
                      title="Salida"
                      subtitle="Resultado final"
                      active={pathHighlights.output}
                      tone="violet"
                      className="w-full max-w-44 px-5 py-6 text-center"
                    />
                  </div>

                  <div className="flex flex-col items-center justify-center gap-5 xl:min-h-full">
                    <DiagramBox
                      title="Memoria principal"
                      subtitle="Instrucciones y datos"
                      active={pathHighlights.memory}
                      tone="slate"
                      className="w-full max-w-[340px] min-h-[300px] px-5 py-6"
                    >
                      <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600 ring-1 ring-slate-200">
                        Programa almacenado: direcciones 0-{selectedProgram.instructions.length - 1}
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl bg-white px-4 py-4 text-sm ring-1 ring-slate-200">
                          <div className="font-semibold text-slate-500">A</div>
                          <div className="mt-2 text-lg font-bold text-slate-900">{simulation.memory.A ?? "vacio"}</div>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-4 text-sm ring-1 ring-slate-200">
                          <div className="font-semibold text-slate-500">B</div>
                          <div className="mt-2 text-lg font-bold text-slate-900">{simulation.memory.B ?? "vacio"}</div>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-4 text-sm ring-1 ring-slate-200 sm:col-span-3 xl:col-span-1">
                          <div className="font-semibold text-slate-500">C</div>
                          <div className="mt-2 text-lg font-bold text-slate-900">{simulation.memory.C ?? "vacio"}</div>
                        </div>
                      </div>
                    </DiagramBox>

                    <div className="w-full max-w-[340px] space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-slate-300" />
                        <div className={[
                          "min-h-9 flex-1 rounded-full border px-4 py-2 text-center text-sm font-semibold transition-all",
                          pathHighlights.addressBus
                            ? "border-blue-300 bg-blue-50 text-blue-700 shadow-[0_0_0_4px_rgba(59,130,246,0.08)]"
                            : "border-slate-200 bg-slate-100 text-slate-600",
                        ].join(" ")}>
                          Bus de direcciones
                        </div>
                        <div className="h-px flex-1 bg-slate-300" />
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-slate-300" />
                        <div className={[
                          "min-h-9 flex-1 rounded-full border px-4 py-2 text-center text-sm font-semibold transition-all",
                          pathHighlights.dataBus
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-[0_0_0_4px_rgba(16,185,129,0.08)]"
                            : "border-slate-200 bg-slate-100 text-slate-600",
                        ].join(" ")}>
                          Bus de datos
                        </div>
                        <div className="h-px flex-1 bg-slate-300" />
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-slate-300" />
                        <div className={[
                          "min-h-9 flex-1 rounded-full border px-4 py-2 text-center text-sm font-semibold transition-all",
                          pathHighlights.controlBus
                            ? "border-amber-300 bg-amber-50 text-amber-700 shadow-[0_0_0_4px_rgba(245,158,11,0.08)]"
                            : "border-slate-200 bg-slate-100 text-slate-600",
                        ].join(" ")}>
                          Bus de control
                        </div>
                        <div className="h-px flex-1 bg-slate-300" />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center xl:justify-end">
                    <DiagramBox
                      title="CPU"
                      subtitle="Unidad central de procesamiento"
                      active={pathHighlights.cpu}
                      tone="blue"
                      className="w-full min-w-0 max-w-[380px] rounded-[28px] px-6 py-6"
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        <DiagramBox
                          title="Unidad de Control"
                          active={pathHighlights.control}
                          tone="amber"
                          className="min-h-[138px] px-4 py-5"
                        />
                        <DiagramBox
                          title="ALU"
                          active={pathHighlights.alu}
                          tone="emerald"
                          className="min-h-[138px] px-4 py-5"
                        />
                        <DiagramBox
                          title="Registros"
                          active={pathHighlights.registers}
                          tone="blue"
                          className="sm:col-span-2 px-4 py-5"
                        >
                          <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-[0.8fr_1.4fr_0.8fr]">
                            <div className={[
                              "min-w-0 rounded-xl border bg-white px-3 py-3 text-center transition-all",
                              registerHighlights.pc ? "border-blue-300 bg-blue-50 shadow-sm" : "border-slate-200",
                            ].join(" ")}>
                              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">PC</div>
                              <div className="mt-2 text-lg font-bold text-slate-900">{simulation.pc}</div>
                            </div>
                            <div className={[
                              "min-w-0 rounded-xl border bg-white px-3 py-3 text-center transition-all",
                              registerHighlights.ir ? "border-blue-300 bg-blue-50 shadow-sm" : "border-slate-200",
                            ].join(" ")}>
                              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">IR</div>
                              <div className="mt-2 overflow-hidden text-lg font-bold text-slate-900 whitespace-nowrap text-ellipsis">{simulation.ir || "-"}</div>
                            </div>
                            <div className={[
                              "min-w-0 rounded-xl border bg-white px-3 py-3 text-center transition-all",
                              registerHighlights.acc ? "border-emerald-300 bg-emerald-50 shadow-sm" : "border-slate-200",
                            ].join(" ")}>
                              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">ACC</div>
                              <div className="mt-2 text-lg font-bold text-slate-900">{simulation.acc}</div>
                            </div>
                          </div>
                        </DiagramBox>
                      </div>
                    </DiagramBox>
                  </div>
                </div>
              </div>

              <div className="grid gap-px border-t border-slate-200 bg-slate-200 lg:grid-cols-2">
                <div className="bg-white p-5 lg:p-6">
                  <h2 className="text-lg font-semibold text-slate-900">Panel de programa cargado</h2>
                  <div className="mt-4 space-y-3">
                    {selectedProgram.instructions.map((instruction, index) => {
                      const state = getInstructionState(index);

                      return (
                        <div
                          key={instruction}
                          className={[
                            "rounded-2xl border px-4 py-3 text-sm font-medium transition-all lg:text-[15px]",
                            state === "current"
                              ? "border-blue-200 bg-blue-50 text-blue-800 ring-2 ring-blue-200"
                              : state === "executed"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-white text-slate-700",
                          ].join(" ")}
                        >
                          {index} {instruction}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white p-5 lg:p-6">
                  <h2 className="text-lg font-semibold text-slate-900">Historial breve</h2>
                  <div className="mt-4 space-y-2.5">
                    {simulation.history.length === 0 ? (
                      <p className="text-sm text-slate-500">Todavia no hay pasos ejecutados.</p>
                    ) : (
                      simulation.history
                        .slice()
                        .reverse()
                        .map((entry, index) => (
                          <div key={`${entry}-${index}`} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                            {entry}
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>

          <div className="space-y-6 xl:col-span-3">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">Controles</h2>
                <span className={[
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  simulation.isFinished
                    ? "bg-violet-50 text-violet-700"
                    : isAutoRunning
                      ? "bg-amber-50 text-amber-700"
                      : simulation.loaded
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600",
                ].join(" ")}>
                  {getStatusLabel()}
                </span>
              </div>
              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-900">Operacion</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {(Object.keys(PROGRAMS) as ProgramKey[]).map((programKey) => {
                    const program = PROGRAMS[programKey];

                    return (
                      <button
                        key={program.key}
                        type="button"
                        onClick={() => handleSelectProgram(program.key)}
                        className={[
                          "rounded-2xl px-3 py-3 text-sm font-semibold transition",
                          selectedProgramKey === program.key
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50",
                        ].join(" ")}
                      >
                        {program.shortName}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <p className="text-sm font-semibold text-slate-900">Operacion actual: {selectedProgram.name}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{selectedProgram.description}</p>
                  <p className="mt-2 text-sm text-slate-500">{selectedProgram.expectedExample}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleLoadProgram}
                  className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  Cargar programa
                </button>
                <button
                  type="button"
                  onClick={handleStep}
                  disabled={simulation.isFinished}
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Ejecutar paso
                </button>
                <button
                  type="button"
                  onClick={handleRunAll}
                  disabled={simulation.isFinished}
                  className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isAutoRunning ? "Ejecutando..." : "Ejecutar completo"}
                </button>
                <button
                  type="button"
                  onClick={handlePause}
                  disabled={!isAutoRunning}
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Pausar
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600 sm:col-span-2"
                >
                  Reiniciar
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Registros de la CPU</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">PC</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{simulation.pc}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">ACC</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-600">{simulation.acc}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">IR</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{simulation.ir || "Vacio"}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Estado</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{getStatusLabel()}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Entrada de datos</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Valor A</span>
                  <input
                    type="number"
                    value={inputA}
                    onChange={(event) => setInputA(event.target.value)}
                    disabled={isAutoRunning}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Valor B</span>
                  <input
                    type="number"
                    value={inputB}
                    onChange={(event) => setInputB(event.target.value)}
                    disabled={isAutoRunning || !selectedProgram.usesInputB}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                </label>
              </div>
              <p className="mt-3 text-sm text-slate-500">
                Si el valor ingresado es invalido, la simulacion usara 0 para continuar.
              </p>
              {!selectedProgram.usesInputB ? (
                <p className="mt-2 text-sm text-slate-500">
                  En la operacion de copia de datos, el valor B no se utiliza.
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Salida</h2>
              <div className="mt-4 rounded-2xl bg-violet-50 p-4 ring-1 ring-violet-200">
                <p className="text-sm text-violet-700">
                  {simulation.output === null
                    ? "No hay resultado todavia."
                    : `Resultado mostrado: ${simulation.output}`}
                </p>
                <p className="mt-2 text-sm text-violet-600">
                  Operacion ejecutada: {selectedProgram.shortName}
                </p>
              </div>
            </div>

          </div>
        </section>
      </div>
    </main>
  );
}
