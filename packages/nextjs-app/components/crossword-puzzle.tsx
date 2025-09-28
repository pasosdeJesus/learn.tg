"use client"

import clg from "crossword-layout-generator-with-isolated"
import { useSession, getCsrfToken } from "next-auth/react"
import { useState, useEffect } from "react"
import { usePublicClient, useWalletClient } from 'wagmi';
import { useAccount } from 'wagmi'


import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { cn } from "../lib/utils"

interface WordPlacement {
  word: string
  row: number
  col: number
  direction: "across" | "down"
  number: number
  clue: string
}

interface Cell {
  letter: string
  number?: number
  isBlocked: boolean
  userInput: string
  belongsToWords: number[]
}

interface CrosswordPuzzleProps {
  questions: string;
}

export default function CrosswordPuzzle(props: CrosswordPuzzleProps) {
  const [newWord, setNewWord] = useState("")
  const [grid, setGrid] = useState<Cell[][]>([])
  const [placements, setPlacements] = useState<WordPlacement[]>([])
  const [gridSize, setGridSize] = useState({ rows: 15, cols: 15 })
  const [showSolution, setShowSolution] = useState(false)
  const [flashError, setFlashError] = useState("")
  const [flashSuccess, setFlashSuccess] = useState("")


  // Initialize empty grid
  const initializeGrid = (rows: number, cols: number): Cell[][] => {
    return Array(rows)
      .fill(null)
      .map(() =>
        Array(cols)
          .fill(null)
          .map(() => ({
            letter: "",
            isBlocked: true,
            userInput: "",
            belongsToWords: [],
          })),
      )
  }

  const generateCrossword = () => {
    const newGrid = initializeGrid(gridSize.rows, gridSize.cols)
    const newPlacements: WordPlacement[] = []
    let wordNumber = 1

    if (props.questions == "") {
      return 
    }
    let input_json = JSON.parse(props.questions)
    if (!input_json || input_json.length == 0) {
      return
    }

    let scrambled = []
    while (input_json.length > 0) {
      let np = Math.floor(Math.random()*input_json.length)
      scrambled.push(input_json[np])
      input_json.splice(np, 1)
    }
    console.log("scrambled=", scrambled)
    let layout = clg.generateLayout(scrambled)
    let rows = layout.rows;
    let cols = layout.cols;
    let table = layout.table; // table as two-dimensional array
    let output_html = layout.table_string; // table as plain text (with HTML line breaks)
    let output_json = layout.result;
    

    for(let index = 0; index < output_json.length; index++) {
      let word = output_json[index].answer
      let clue = output_json[index].clue
      let row = output_json[index].starty
      let col = output_json[index].startx
      let direction = output_json[index].orientation
      if (direction == "down" || direction == "across") {
        for (let i = 0; i < word.length; i++) {
          const currentRow = direction === "down" ? row + i : row
          const currentCol = direction === "across" ? col + i : col
          newGrid[currentRow][currentCol] = {
            letter: word[i],
            number: i === 0 ? wordNumber : newGrid[currentRow][currentCol].number,
            isBlocked: false,
            userInput: "",
            belongsToWords: [...(newGrid[currentRow][currentCol].belongsToWords || []), wordNumber],
          }
        }
        newPlacements.push({
          word,
          row,
          col,
          direction,
          number: wordNumber,
          clue: clue,
        })
        wordNumber++
      }
    }
    setGrid(newGrid)
    setPlacements(newPlacements)
  }

  // Handle user input
  const handleCellInput = (row: number, col: number, value: string) => {
    if (value.length > 1) return

      const newGrid = [...grid]
      newGrid[row][col] = {
        ...newGrid[row][col],
        userInput: value.toUpperCase(),
      }
      setGrid(newGrid)
  }

  // Check if puzzle is solved
  const isPuzzleSolved = () => {
    if (grid.length == 0) {
      return false
    }
    return grid.every(
      (row) => row.every(
        (cell) => cell.isBlocked || cell.userInput != ''
      )
    )
  }

  const handleSubmit = () => {
    setFlashSuccess("")
    setFlashError("")
    console.log(grid)
    console.log(placements.length)
    let probs: number[] = []
    for(let i = 0; i < placements.length; i++) {
      let nrow = placements[i].row
      let ncol = placements[i].col
      let dir = placements[i].direction
      let word = placements[i].word
      for (let j = 0; j < word.length; j++) {
        if (
          nrow >= grid.length || ncol >= grid[nrow].length ||
          grid[nrow][ncol].userInput.toUpperCase() != word[j].toUpperCase()
        ) {
          console.log(
            "Problema en i",i, "-esima palabra word=", word, 
            ", posición j=", j, ", se esperaba =", word[j].toUpperCase(),
            "se obtuvo",grid[nrow][ncol].userInput.toUpperCase()
          )
          if (!probs.includes(i+1)) {
            probs.push(i+1)
          }
        }
        if (dir == "across") {
          ncol++
        } else {
          nrow++
        }
      }
    }


    //contract.methods.balanceOf(address).call()

    if (probs.length == 0) {
      setFlashSuccess("Correct, however this course doesn't have scolarships active in this moment")
    } else {
      setFlashError("Problem(s) with word(s) " + probs.join(", "))
    }

  }

  // Generate crossword on words change
  useEffect(() => {
    generateCrossword()
  }, [])

  const acrossClues = placements.filter((p) => p.direction === "across")
  const downClues = placements.filter((p) => p.direction === "down")

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Crossword Grid */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Crossword Puzzle
              </CardTitle>
              {flashError != "" && <div className="bg-red-500">{flashError}</div>}
              {flashSuccess != "" && <div className="bg-green-500">{flashSuccess}</div>}
            </CardHeader>
            <CardContent>
              <div className="grid gap-1 p-4 bg-muted rounded-lg overflow-auto">
                {grid.map((row, rowIndex) => (
                  <div key={rowIndex} className="flex gap-1">
                    {row.map((cell, colIndex) => (
                      <div
                        key={`${rowIndex}-${colIndex}`}
                        className={cn(
                          "w-8 h-8 border border-border relative",
                          cell.isBlocked ? "bg-black" : "bg-white dark:bg-background",
                        )}
                      >
                        {!cell.isBlocked && (
                          <>
                            {cell.number && (
                              <span className="absolute top-0 left-0 text-xs font-bold leading-none p-0.5">
                                {cell.number}
                              </span>
                            )}
                            <input
                              type="text"
                              value={showSolution ? cell.letter : cell.userInput}
                              onChange={(e) => handleCellInput(rowIndex, colIndex, e.target.value)}
                              className={cn(
                                "w-full h-full text-center text-sm font-bold border-none outline-none bg-transparent",
                                showSolution && "text-blue-600 dark:text-blue-400",
                              )}
                              maxLength={1}
                              disabled={showSolution}
                            />
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              {isPuzzleSolved() && 
                <div>
                  <Badge className="bg-orange-500">Completed</Badge>
                  <Button className="bg-gray-600" onClick={handleSubmit}>Submit answer and earn part of scolarship if elegible</Button>
                </div>
              }
            </CardContent>
          </Card>
        </div>

        {/* Clues */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Across</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {acrossClues.map((placement) => (
                <div key={`across-${placement.number}`} className="text-sm">
                  <span className="font-bold">{placement.number}.</span> {placement.clue}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Down</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {downClues.map((placement) => (
                <div key={`down-${placement.number}`} className="text-sm">
                  <span className="font-bold">{placement.number}.</span> {placement.clue}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

