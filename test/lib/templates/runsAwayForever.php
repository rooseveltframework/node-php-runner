<?php
// takes memory and never gives any back, the way a template with a runaway loop in it would
//
// it does this without recursing on purpose. an earlier version of this included itself, which
// reached the same limit but by way of a stack tens of thousands of frames deep, and php printed
// every one of them: the test passed and buried the rest of the output while doing it
$phpRunnerHungry = [];
while (true) {
  $phpRunnerHungry[] = str_repeat('x', 1048576);
}
