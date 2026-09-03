<?php
// names the parts of the model it wants as strings rather than as variables, which is the one way a
// template can read something without the analysis seeing a variable for it
?>
<p><?= implode(',', compact('one', 'two')) ?></p>
