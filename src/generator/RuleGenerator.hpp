#ifndef RULEGENERATOR_H
#define RULEGENERATOR_H
#pragma once

#include <algorithm>

#include "../lang/RuleLangResult.hpp"
#include "../meta/GeneratorMeta.hpp"
#include "../meta/IGroupRepository.hpp"
#include "Generator.hpp"
#include "Rule.hpp"

class RuleGenerator : public Generator {
private:
  vector<shared_ptr<Rule>> _rules;
  vector<shared_ptr<ILangResult>> _results;

public:
  RuleGenerator(shared_ptr<IGeneratorMeta> meta);
  RuleGenerator(shared_ptr<IGeneratorMeta> meta,
                vector<shared_ptr<Rule>> rules);
  vector<shared_ptr<Rule>> &rules();
  const vector<shared_ptr<Rule>> &rules() const;
  virtual vector<shared_ptr<ILangResult>>
  results(IGroupRepository *repo) const override;
};
#endif